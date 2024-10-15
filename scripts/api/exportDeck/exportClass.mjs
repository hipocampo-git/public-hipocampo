import axios from 'axios';
import path from 'path';
import {promises as fspromises} from 'fs';
import JSON5 from 'json5';
import _ from 'lodash';

/**
 * Export class for exporting decks.
 */
export class ExportClass {
  /**
   * Constructor
   * @param {string} apiUrl
   * @param {string} dataPath
   * @param {object} spinner
   * @param {object} axiosOptions
   * @param {object} logger
   * @param {object} args
   * @param {object} deckOwner
   */
  constructor({
    apiUrl,
    dataPath,
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
    this.dataPath = dataPath;
    this.deckOwner = deckOwner;
    this.deck = {};
    this.spinner = spinner;

    this.fileOutputObject = {};
    this.objectCounts = {
      decks: 0,
      cards: 0,
      assets: 0
    };
  }

  /**
   * Export a deck.
   * @return {Promise<void>}
   */
  exportDeck = async () => {
    const {deck, objectCounts} = this;

    // TODO: Expand this logic to handle multiple decks.
    objectCounts.decks++;
    this.fileOutputObject = {
      objects: [
        {
          type: 'deck',
          name: deck.name,
          id: deck.id,
          description: deck.description,
          synopsis: deck.synopsis,
          textToSpeech: deck.textToSpeech,
          preface: deck.preface,
          feedback: deck.feedback,
          showDontKnow: deck.showDontKnow
        }
      ]
    };

    const cards = await this.getCards(deck.id);

    for (let i = 0; i < cards.length; i++) {
      await this.exportCard(cards[i], deck);
      this.spinner.text = `Exported card ${i + 1} of ${cards.length}`;
    }

    await this.exportShare(deck);

    await this.writeMetadataFile();

    this.spinner.succeed('Card export complete');
  };

  /**
   * Write the metadata file.
   * @return {Promise<void>}
   */
  writeMetadataFile = async () => {
    const {logger, deckPath} = this;

    this.logger.verbose(`Writing ${deckPath}${path.sep}metadata.json`);
    await fspromises.writeFile(
      `${deckPath}${path.sep}metadata.json5`,
      JSON5.stringify(this.fileOutputObject, null, ' '),
      'utf8'
    );

    logger.verbose(`Export complete of deck id ${this.deck.id}`);
  };

  /**
   * Export all the responses for a deck and user.
   * @return {Promise<void>}
   */
  exportResponses = async () => {
    const {apiUrl, axiosOptions, logger, deck, deckOwner, deckPath} = this;

    const fileOutputObject = {
      objects: []
    };

    // Conditionally export responses
    // Start with the study sessions
    const studySessionResponse = await axios.get(
      `${apiUrl}/study-sessions?deckid=${deck.id}&userid=${deckOwner.id}`,
      axiosOptions
    );

    for (let i = 0; i < studySessionResponse.data.length; i++) {
      const studySession = studySessionResponse.data[i];

      const studySessionObject = Object.assign(
        {...studySession},
        {
          deck_id: `_${studySession.deck_id}`,
          type: 'studySession',
          user_id: `&${studySession.user_id}`,
          id: studySession.id,
          response_count: undefined,
          response_duration_sum: undefined,
          correct_count: undefined,
          total_score: undefined
        }
      );

      // Remove the undefined properties
      Object.keys(studySessionObject).forEach(
        (key) =>
          studySessionObject[key] === undefined &&
          delete studySessionObject[key]
      );

      fileOutputObject.objects.push(studySessionObject);

      const response = await axios.get(
        `${apiUrl}/responses?studysessionid=${studySession.id}`,
        axiosOptions
      );

      const responses = response.data;

      for (let j = 0; j < responses.length; j++) {
        const response = responses[j];

        logger.verbose(JSON.stringify(response));

        const responseObject = Object.assign(
          {...response},
          {
            type: 'response',
            card_id: `_${response.card_id}`,
            answer_id: `_${response.answer_id}`,
            id: response.id,
            study_session_id: `_${studySession.id}`,
            old_has_not_known: undefined,
            username: undefined
          }
        );

        Object.keys(responseObject).forEach(
          (key) =>
            responseObject[key] === undefined && delete responseObject[key]
        );

        fileOutputObject.objects.push(responseObject);
      }

      this.spinner.text = `Exported study session ${i + 1} of ${
        studySessionResponse.data.length
      } study sessions `;
    }

    logger.verbose(`Writing ${deckPath}${path.sep}responses.json`);
    await fspromises.writeFile(
      `${deckPath}${path.sep}responses.json5`,
      JSON5.stringify(fileOutputObject, null, ' '),
      'utf8'
    );
  };

  /**
   * Make an api call to retrieve a deck by name and owner.
   * @return {Promise<*>}
   */
  getDeck = async () => {
    let response = await axios.get(
      `${this.apiUrl}/users?search=${this.deckOwner.username}`,
      this.axiosOptions
    );

    this.logger.verbose(JSON.stringify(response.data));

    response = await axios.get(`${this.apiUrl}/decks/get2`, {
      ...this.axiosOptions,
      params: {filters: {name: this.args.deckName}}
    });

    const decks = response.data.results;

    const retVal = decks.find((deck) => {
      return (
        deck.name === this.args.deckName &&
        deck.user_id + '' === this.deckOwner.id + ''
      );
    });

    if (!retVal) {
      throw new Error(
        `Deck ${this.args.deckName}` +
          ` with owner ${this.deckOwner.username} not found.`
      );
    }

    this.deck = retVal;

    this.deckPath = `${this.dataPath + path.sep + this.deck.id}`;
  };

  /**
   * Export a card.
   * @param {object} card
   * @param {object} deck
   * @return {Promise<void>}
   */
  exportCard = async (card, deck) => {
    const {logger, fileOutputObject, objectCounts} = this;

    objectCounts.cards++;

    await this.exportAssetsByCard(card);

    const answers = card.answer;

    // Check answers for assets and export if necessary
    await this.exportAnswers(answers);

    const cardObject = {
      type: 'card',
      algo: card.algorithm_id,
      deck: deck.name,
      question: card.question,
      hint: card.hint,
      explanation: card.explanation,
      notes: card.notes,
      answers,
      testAuto: card.testAuto,
      algoSettings: card.algoSettings,
      id: card.id,
      deckId: `_${deck.id}`
    };

    fileOutputObject.objects.push(cardObject);

    logger.verbose(`Processed card ${card.id}`);
    logger.verbose(`Exported card with id of ${card.id}`);
  };

  /**
   * Export an array of answers.
   * @param {[object]} answers
   * @return {Promise<void>}
   */
  exportAnswers = async (answers) => {
    const {assetUrl} = this;

    for (let i = 0; i < answers.length; i++) {
      const answer = answers[i];

      if (answer.text.indexOf(`"${assetUrl}`) !== -1) {
        const assetId = this.extractAssetId(answer.text);

        // Export the asset by id
        const assetObject = await this.exportAssetById(assetId);
        answer.assetId = '_' + assetId;
        answer.newAssetId = assetObject.id;
      }
    }
  };

  /**
   * Extract the asset id from text that contains an asset url reference.
   * @param {string} text
   * @return {string}
   */
  extractAssetId = (text) => {
    const beginIndex = text.indexOf(assetUrl);
    const endIndex = text.indexOf('"', beginIndex + assetUrl.length);

    const assetId = text.substring(beginIndex + assetUrl.length + 1, endIndex);

    return assetId;
  };

  /**
   * Export a share.
   * @param {Object} deck - deck metadata
   * @return {Promise<void>}
   */
  exportShare = async (deck) => {
    const {apiUrl, fileOutputObject, axiosOptions} = this;



    if (deck.shareKey) {
      const response = await axios.get(
        `${apiUrl}/shares?key=${encodeURIComponent(deck.shareKey)}`,
        axiosOptions
      );

      const share = response.data[0];

      const shareObject = {
        type: 'share',
        expiration: share.expiration,
        defaultIsAdminMode: share.defaultIsAdminMode,
        defaultIsRandomMode: share.defaultIsRandomMode,
        defaultIsTextToSpeechMode: share.defaultIsTextToSpeechMode,
        defaultIsSaveResponsesMode: share.defaultIsSaveResponsesMode,
        default_layout_id: share.default_layout_id
      };

      fileOutputObject.objects.push(shareObject);
    }
  };

  /**
   * Export all the assets associated with a particular card.
   * @param {object} card
   * @return {Promise<void>}
   */
  exportAssetsByCard = async (card) => {
    const {
      logger,
      apiUrl,
      axiosOptions,
      fileOutputObject,
      objectCounts,
      deckPath
    } = this;

    const response = await axios.get(
      `${apiUrl}/assets?cardId=${card.id}`,
      axiosOptions
    );

    for (let i = 0; i < response.data.length; i++) {
      objectCounts.assets++;

      const asset = response.data[i];

      logger.verbose(JSON.stringify(response.data[i]));

      const assetObject = {
        type: 'asset',
        fileName: asset.file_name,
        name: asset.name,
        fileType: asset.fileType,
        user_id: `&${asset.user_id}`,
        localFilePath: '',
        id: asset.id
      };

      let options = _.clone(axiosOptions);

      options.params = {
        Key: asset.id,
        UrlType: 'get',
        ContentType: asset.type,
        TextToSpeech: false
      };

      _.merge(options.headers, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers':
          'Origin, X-Requested-With, Content-Type, Accept',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS'
      });

      const tempUrlResponse = await axios.get(
        `${apiUrl}/generate-url`,
        options
      );

      options = _.clone(axiosOptions);

      options.responseType = 'arraybuffer';

      _.merge(options.headers, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers':
          'Origin, X-Requested-With, Content-Type, Accept',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS'
      });

      const fileResponse = await axios.get(tempUrlResponse.data.url, options);

      await fspromises.writeFile(
        `${deckPath}${path.sep}${asset.file_name}`,
        fileResponse.data,
        'binary'
      );

      logger.verbose(`Exported asset with id of ${asset.id}`);

      fileOutputObject.objects.push(assetObject);
    }
  };

  /**
   * Export an asset by id
   * @param {number} assetId
   * @return {Promise<*>}
   */
  exportAssetById = async (assetId) => {
    const {
      apiUrl,
      axiosOptions,
      fileOutputObject,
      objectCounts,
      deckPath
    } = this;
    const response = await axios.get(
      `${apiUrl}/assets/${assetId}`,
      axiosOptions
    );

    const asset = response.data[0];

    objectCounts.assets++;

    const assetObject = {
      type: 'asset',
      fileName: asset.file_name,
      name: asset.name,
      fileType: asset.fileType,
      user_id: `&${asset.user_id}`,
      localFilePath: '',
      id: asset.id,
      cardId: `_${asset.card_id}`
    };

    let options = _.clone(axiosOptions);

    options.params = {
      Key: asset.id,
      UrlType: 'get',
      ContentType: asset.type
    };

    _.merge(options.headers, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers':
        'Origin, X-Requested-With, Content-Type, Accept',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS'
    });

    const tempUrlResponse = await axios.get(`${apiUrl}/generate-url`, options);

    options = {};

    options.responseType = 'arraybuffer';

    _.merge(options.headers, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers':
        'Origin, X-Requested-With, Content-Type, Accept',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS'
    });

    const fileResponse = await axios.get(tempUrlResponse.data.url, options);

    await fspromises.writeFile(
      `${deckPath}${path.sep}${asset.file_name}`,
      fileResponse.data,
      'binary'
    );

    fileOutputObject.objects.push(assetObject);

    return assetObject;
  };

  /**
   * Make an api call to retrieve cards for a given deck id.
   * @param {number} deckId
   * @return {Promise<*>}
   */
  getCards = async (deckId) => {
    const {apiUrl, axiosOptions} = this;

    const response = await axios.get(
      `${apiUrl}/cards?deckid=${deckId}`,
      axiosOptions
    );

    return response.data.data;
  };
}
