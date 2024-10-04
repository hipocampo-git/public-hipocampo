import axios from 'axios';
import {promises as fsPromises} from 'fs';
import path from 'path';
import JSON5 from 'json5';
import _ from 'lodash';
import dayjs from 'dayjs';
import * as utils from '../../common/utils.mjs';
import {nanoid} from 'nanoid';

/**
 * Class for importing a deck
 */
export class ImportClass {
  /**
   * Constructor
   * @param {string} apiUrl
   * @param {string} deckPath
   * @param {string} fileData
   * @param {object} spinner
   * @param {object} axiosOptions
   * @param {object} logger
   * @param {object} args
   * @param {object} deckOwner
   */
  constructor({
    apiUrl,
    deckPath,
    fileData,
    spinner,
    axiosOptions,
    logger,
    args,
    deckOwner
  }) {
    this.apiUrl = apiUrl;
    this.axiosOptions = axiosOptions;
    this.logger = logger;
    this.args = args;
    this.deckOwner = deckOwner;
    this.spinner = spinner;
    this.deckPath = deckPath;

    this.fileInputObject = JSON5.parse(fileData);
  }

  /**
   * Rename a deck if it conflicts with an existing deck
   * @param {string} deckName
   * @return {Promise<void>}
   */
  renameConflictingDeck = async (deckName) => {
    const {args, apiUrl, axiosOptions, logger, deckOwner} = this;

    if (args.renameConflict) {
      // Check if there's an existing deck
      const response = await axios.get(
        `${apiUrl}/decks?deckName=${deckName}&ownerId=${this.deckOwner.id}`,
        axiosOptions
      );

      // Probably need to filter multiple decks here.

      if (response.status === 200 && response.data.length > 0) {
        const newName = response.data[0].name.slice(0, 24) + '_' + nanoid(5);

        let payload = {
          name: newName,
          userId: deckOwner.id
        };

        // Only merge certain fields
        payload = _.merge(
          payload,
          _.pick(response.data[0], [
            'feedback',
            'preface',
            'showDuration',
            'defaultPrefaceSettings',
            'showDontKnow'
          ])
        );

        const response2 = await axios.put(
          `${apiUrl}/decks/${response.data[0].id}`,
          payload,
          axiosOptions
        );

        if (response2.status === 200) {
          logger.info(`Deck conflict renamed to ${newName}`);
        }
      }
    }
  };

  /**
   * Import a deck
   * @return {Promise<void>}
   */
  importDeck = async () => {
    let deckObject = this.findObjectsByType('deck');

    if (deckObject.length !== 1) {
      throw new Error(
        'Exactly one deck expected in metadata' +
          `file. ${deckObject.length} found.`
      );
    } else {
      deckObject = deckObject[0];
    }

    if (_.isString(deckObject.id) && deckObject.id.startsWith('&')) {
      this.newDeckId = deckObject.id.slice(1);
    } else {
      await this.createDeck(deckObject);
    }

    const assetObjects = this.findObjectsByType('asset');

    for (let i = 0; i < assetObjects.length; i++) {
      const assetId = await this.createAsset(assetObjects[i]);
      this.spinner.text = `New asset created with id of ${assetId} (${
        i + 1
      } of ${assetObjects.length} assets)`;
      assetObjects[i].newId = assetId;
    }

    const cardObjects = this.findObjectsByType('card');

    for (let i = 0; i < cardObjects.length; i++) {
      const cardId = await this.createCard(cardObjects[i]);
      this.spinner.text = `Card ${i + 1} of ${
        cardObjects.length
      } cards created`;

      cardObjects[i].newId = cardId;
    }

    const shareObject = this.findObjectsByType('share');

    // There should be only a single share object.
    await this.createShare(shareObject[0]);

    this.spinner.succeed('Card import complete');
  };

  /**
   * Create a deck
   * @param {object} deck
   * @return {Promise<void>}
   */
  createDeck = async (deck) => {
    const {apiUrl, axiosOptions, logger, args, deckOwner} = this;

    try {
      const payload = {
        name: args.deckName || deck.name,
        testAuto: args.testAuto || deck.testAuto || undefined,
        textToSpeech: !!deck.textToSpeech,
        description: deck.description || undefined,
        preface: !!deck.preface,
        feedback: !!deck.feedback,
        showDontKnow: !!deck.showDontKnow,
        userId: deckOwner.id,
        answerLanguage: deck.answerLanguage || undefined,
        questionLanguage: deck.questionLanguage || undefined
      };

      await this.renameConflictingDeck(payload.name);

      const response = await axios.post(
        `${apiUrl}/decks`,
        payload,
        axiosOptions
      );

      logger.info(`New deck created with id of ${response.data.id}`);

      this.newDeckId = response.data.id;
    } catch (error) {
      logger.error(error.message);
      throw error;
    }
  };

  /**
   * Create an asset
   * @param {object} asset
   * @return {Promise<void>}
   */
  createAsset = async (asset) => {
    const {apiUrl, axiosOptions, logger, args, deckPath, deckOwner} = this;

    const payload = {
      name: asset.name,
      fileType: asset.fileType,
      file_name: asset.fileName,
      testAuto: args.testAuto || asset.testAuto || undefined,
      userId: deckOwner.id
    };

    logger.verbose(JSON.stringify(asset, null, '\t'));
    logger.verbose(JSON.stringify(payload, null, '\t'));
    logger.verbose(JSON.stringify(axiosOptions, null, '\t'));

    // Moved these commands to the top of the function so that we fail prior
    // to creating the db record if the file doesn't exist. Otherwise we end
    // up with an orphaned db record.
    const filePath = deckPath + path.sep + asset.fileName;
    const fileData = await fsPromises.readFile(filePath);

    // Upload the asset metadata
    const response = await axios.post(
      `${apiUrl}/assets`,
      payload,
      axiosOptions
    );

    let options = _.clone(axiosOptions);

    _.merge(options.headers, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers':
        'Origin, X-Requested-With, Content-Type, Accept',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS'
    });

    options.params = {
      Key: response.data.id,
      UrlType: 'put',
      ContentType: asset.fileType
    };

    logger.verbose(JSON.stringify(options, null, '\t'));

    const urlResponse = await axios.get(`${apiUrl}/generate-url`, options);

    options = {};
    options.headers = {
      'Content-Type': asset.fileType,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers':
        'Origin, X-Requested-With, Content-Type, Accept',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS'
    };

    logger.verbose(filePath);
    logger.verbose(urlResponse.data.url);
    logger.verbose(JSON.stringify(options, null, '\t'));

    await axios.put(urlResponse.data.url, fileData, options);

    return response.data.id;
  };

  /**
   * Create a card
   * @param {object} card
   * @param {number} deckId
   * @return {Promise<void>}
   */
  createCard = async (card, deckId) => {
    const {apiUrl, axiosOptions, logger, args, fileInputObject} = this;
    // Check if question has an asset
    if (utils.containsAssetLink(card.question)) {
      const assetId = utils.extractAssetId(card.question);
      // Update the asset ID
      const assetObject = fileInputObject.objects.find((object) => {
        if (object.type === 'asset') {
          return object.id + '' === assetId;
        }
      });

      logger.verbose(JSON.stringify(assetObject));

      // TODO: Create the following shared functions in shared/assetHandler and
      //       convert any duplicated code:
      //       (There are probably a few more that would be useful)
      //       1) isContainsAsset()
      //       2) extractAssetId()
      //       3) replaceAssetId()

      // Replace the id in the question
      card.question = utils.replaceAssetId(card.question, assetObject.newId);
    }

    const payload = {
      contents: {
        question: card.question,
        answer: null,
        deck: this.newDeckId,
        testAuto: args.testAuto || card.testAuto || undefined,
        hint: card.hint,
        verificationAlgorithm: card.algo,
        algoSettings: card.algoSettings
      }
    };

    const response = await axios.post(`${apiUrl}/cards`, payload, axiosOptions);

    if (response.status !== 200) {
      throw new Error(`Failed to create card: ${response.data.message}`);
    }

    for (let j = 0; j < card.answers.length; j++) {
      const answerId = await this.createAnswer(
        card.answers[j],
        response.data.id
      );
      card.answers[j].newId = answerId;
    }

    return response.data.id;
  };

  /**
   * Create a share
   * @param {Object} share - share metadata
   * @param {Number} deckId
   * @return {Promise<void>}
   */
  createShare = async (share) => {
    const {apiUrl, axiosOptions, logger, args} = this;
    if (share) {
      const expiration = dayjs(share.expiration).format('YYYY-MM-DD HH:mm:ss');

      // expiration += ' ' + dayjs(share.expiration).format('HH:mm:ss');

      const payload = {
        checkedAdmin: share.checkedAdmin,
        checkedRandom: share.checkedRandom,
        checkedSaveResponses: share.checkedSaveResponses,
        checkedTextToSpeech: share.checkedTextToSpeech,
        deckId: this.newDeckId,
        expiration: expiration,
        testAuto: args.testAuto || undefined
      };

      await axios.post(`${apiUrl}/shares`, payload, axiosOptions);
      logger.info('Created deck share');
    }
  };

  /**
   * Create an answer
   * @param {object} answer
   * @param {number} cardId
   * @return {Promise<void>}
   */
  createAnswer = async (answer, cardId) => {
    const {apiUrl, axiosOptions, logger, fileInputObject} = this;
    // Check if text contains an asset link
    if (_.isObject(answer)) {
      if (utils.containsAssetLink(answer.text)) {
        logger.verbose(JSON.stringify(answer));

        const assetId = utils.extractAssetId(answer.text);

        const assetObject = fileInputObject.objects.find((object) => {
          return object.type === 'asset' && object.id + '' === assetId;
        });

        logger.verbose(JSON.stringify(assetObject));

        // Substitute the id
        answer.text = utils.replaceAssetId(answer.text, assetObject.newId);
      }
    } else {
      // If we're dealing with a legacy answer string, it should not contain
      // any html (i.e. asset links).
      logger.verbose(JSON.stringify(answer));

      const tmpAnswer = {};
      tmpAnswer.text = answer;
      tmpAnswer.isCorrect = false;

      answer = tmpAnswer;
    }

    const payload = {
      text: answer.text,
      isCorrect: !!answer.isCorrect,
      card_id: cardId,
      groupIndex: answer.groupIndex ? answer.groupIndex : 1
    };

    logger.verbose(JSON.stringify(payload, null, '\t'));

    const response = await axios.post(
      `${apiUrl}/answers`,
      payload,
      axiosOptions
    );

    logger.verbose(`Created answer ${response.data.id}`);

    return response.data.id;
  };

  /**
   * Search the file input object for objects of a particular type.
   * @param {string} type - card|deck|asset, etc.
   * @param {object|undefined} objectsOverride - override the objects to search
   * @return {[Object]}
   */
  findObjectsByType = (type, objectsOverride) => {
    const objects = objectsOverride || this.fileInputObject.objects;

    return objects.filter((object) => {
      return object.type === type;
    });
  };

  /**
   * Import responses
   * @param {string} responseFileData
   * @return {Promise<void>}
   */
  importResponses = async (responseFileData) => {
    this.fileInputObjectResponses = JSON5.parse(responseFileData);

    // Import the study sessions
    const studySessionObjects = this.findObjectsByType(
      'studySession',
      this.fileInputObjectResponses.objects
    );

    for (let i = 0; i < studySessionObjects.length; i++) {
      const studySessionId = await this.createStudySession(
        studySessionObjects[i]
      );
      this.spinner.text = `Study session ${i + 1} of ${
        studySessionObjects.length
      } study sessions created`;

      studySessionObjects[i].newId = studySessionId;

      let responseObjects = this.findObjectsByType(
        'response',
        this.fileInputObjectResponses.objects
      );

      // Filter on responses that belong to this study session
      responseObjects = responseObjects.filter((response) => {
        return response.study_session_id === '_' + studySessionObjects[i].id;
      });

      for (let i = 0; i < responseObjects.length; i++) {
        const responseId = await this.createResponse(
          Object.assign(responseObjects[i], {study_session_id: studySessionId})
        );
        if (!responseId) {
          continue;
        }

        responseObjects[i].newId = responseId;
      }
    }
  };

  /**
   * Create a study session
   * @param {object} studySession
   * @return {Promise<*>}
   */
  createStudySession = async (studySession) => {
    const {apiUrl, axiosOptions, logger} = this;

    // eslint-disable-next-line camelcase
    const start_time = dayjs(studySession.start_time).format(
      'YYYY-MM-DD HH:mm:ss'
    );
    // eslint-disable-next-line camelcase
    const end_time =
      studySession.end_time !== null
        ? dayjs(studySession.end_time).format('YYYY-MM-DD HH:mm:ss')
        : null;

    let deckId = this.newDeckId;
    if (this.args.responses === 'only') {
      deckId = this.args.existingDeckId;
    }

    const payload = Object.assign(
      {...studySession},
      {
        // deckOwner is the user that was passed in through the owner argument
        userId: this.deckOwner.id || studySession.userId.slice(1),
        deckId: deckId,
        test_auto: this.args.testAuto || studySession.test_auto,
        id: undefined,
        // eslint-disable-next-line camelcase
        start_time,
        // eslint-disable-next-line camelcase
        end_time,
        response_count: undefined,
        response_duration_sum: undefined,
        correct_count: undefined,
        total_score: undefined,
        deck_id: undefined
      }
    );

    Object.keys(payload).forEach(
      (key) => payload[key] === undefined && delete payload[key]
    );

    const response2 = await axios.post(
      `${apiUrl}/study-sessions`,
      {contents: payload},
      axiosOptions
    );

    logger.verbose(`Created study session ${response2.data.id}`);

    return response2.data.id;
  };

  /**
   * Create a response entity
   * @param {object} response
   * @return {Promise<void>}
   */
  createResponse = async (response) => {
    const {apiUrl, axiosOptions, logger, fileInputObject} = this;

    let cardObject;
    let cardIndex;
    if (this.args.responses !== 'only') {
      // Lookup the card id
      cardObject = fileInputObject.objects.find((object) => {
        return object.type === 'card' && '_' + object.id === response.card_id;
      });
    } else {
      // Need to determine the card id from the existing deck. We're going to
      // assume the order of the ids in the json5 file and in the db are
      // the same.

      if (!this.jsonCardObjects) {
        this.jsonCardObjects = this.findObjectsByType('card');
        // Sort them by id.
        this.jsonCardObjects.sort((a, b) => {
          return a.id - b.id;
        });
      }

      if (!this.dbCardObjects) {
        const response = await axios.get(
          `${apiUrl}/cards?deckId=${this.args.existingDeckId}`,
          axiosOptions
        );
        this.dbCardObjects = response.data.data;

        // Sort them by id.
        this.dbCardObjects.sort((a, b) => {
          return a.id - b.id;
        });
      }

      const tmp = response.card_id.slice(1);

      // Get the ordinal position of the card
      cardIndex = this.jsonCardObjects.findIndex((card) => {
        return card.id + '' === tmp;
      });

      // Get the card id from the db
      cardObject = this.dbCardObjects[cardIndex];
    }

    if (!cardObject) {
      console.warn(`Relative card object id of ${response.card_id} 
       not found for response ${response.id}. Skipping`);
      return;
    }

    let answerObject;

    if (this.args.responses !== 'only') {
      // Answer ids in responses could be null since we recently added
      // the foreign key reference
      if (response.answer_id !== '_null') {
        // Lookup the answer id
        answerObject = cardObject.answers.find((answer) => {
          return '_' + answer.id === response.answer_id;
        });

        if (!answerObject) {
          console.warn(`Relative answer object id of ${response.answer_id} 
         not found for response ${response.id}. Skipping`);
          return;
        }
      } else {
        answerObject = {
          newId: '_null'
        };
      }
    } else {
      // Need to determine the answer id from the existing card. We're going to
      // assume the order of the ids in the json5 file and in the db are
      // the same.

      const jsonAnswers = this.jsonCardObjects[cardIndex].answers.sort(
        (a, b) => {
          return a.id - b.id;
        }
      );

      const dbAnswers = cardObject.answer.sort((a, b) => {
        return a.id - b.id;
      });

      let answerIndex;
      if (response.answer_id === '_null') {
        answerObject = {
          newId: '_null'
        };
      } else {
        answerIndex = jsonAnswers.findIndex((answer) => {
          return '_' + answer.id === response.answer_id;
        });

        answerObject = dbAnswers[answerIndex];
      }

      if (!answerObject) {
        console.log('here 1');
      }
    }

    const payload = Object.assign(
      {...response},
      {
        cardId:
          this.args.responses === 'only' ? cardObject.id : cardObject.newId,
        answerId: answerObject.newId === '_null' ? null : answerObject.newId,
        // deckOwner is the user that was passed in through the owner argument
        userId: this.deckOwner.id || response.userId.slice(1),
        card_id: undefined,
        answer_id: undefined,
        id: undefined,
        created_on: dayjs(response.created_on).format('YYYY-MM-DD HH:mm:ss'),
        test_auto: this.args.testAuto || response.test_auto
      }
    );

    Object.keys(payload).forEach(
      (key) => payload[key] === undefined && delete payload[key]
    );

    const response2 = await axios.post(
      `${apiUrl}/responses`,
      payload,
      axiosOptions
    );

    logger.verbose(`Created response with json5 id ${response.id}
     and db id ${response2.data.id}`);

    return response2.data.id;
  };
}
