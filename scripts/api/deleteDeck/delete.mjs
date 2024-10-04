import axios from 'axios';
import {runWrapper} from '../../common/executeWrapper.mjs';
// TODO: Create a separate deleteClass.mjs like we have for
//       importClass.mjs and exportClass.mjs

/**
 * Callback for the run wrapper.
 */
const callback = async ({logger, deckOwner, args, apiUrl, axiosOptions}) => {
  let deckOwnerObject;

  /**
   * Make an api call to retrieve a deck by name and owner.
   * @param {string} deckName
   * @return {Promise<*>}
   */
  const getDeck = async (deckName) => {
    let response = await axios.get(
      `${apiUrl}/users?search=${deckOwner.username}`,
      axiosOptions
    );

    logger.verbose(JSON.stringify(response.data));

    // Search returns non-exact matches so we need to filter again.
    deckOwnerObject = response.data.find((user) => {
      logger.verbose(user.username);
      return user.username === deckOwner.username;
    });

    logger.verbose(JSON.stringify(deckOwnerObject));

    response = await axios.get(`${apiUrl}/decks`, axiosOptions);

    const decks = response.data;

    const retVal = decks.find((deck) => {
      logger.verbose(JSON.stringify(deck));
      logger.verbose(JSON.stringify(deckOwnerObject));
      return (
        deck.name === deckName && deck.user_id + '' === deckOwnerObject.id + ''
      );
    });

    if (!retVal) {
      throw new Error(
        `Deck ${deckName}` +
          ` with owner ${deckOwnerObject.username} not found.`
      );
    }

    return retVal;
  };

  /**
   * Make an api call to retrieve cards for a given deck id.
   * @param {number} deckId
   * @return {Promise<*>}
   */
  const getCards = async (deckId) => {
    const response = await axios.get(
      `${apiUrl}/cards?deckid=${deckId}`,
      axiosOptions
    );

    const cards = response.data.data;

    logger.info(`Deck contains ${cards.length} cards`);
    return cards;
  };

  /**
   * Delete a card and all of its assets.
   * @param {object} card
   * @return {Promise<void>}
   */
  const deleteCardAndAssets = async (card) => {
    const assets = await axios.get(
      `${apiUrl}/assets?cardId=${card.id}`,
      axiosOptions
    );

    logger.info(`Card ${card.id} has ${assets.data.length} asset references`);

    await deleteCard(card);

    for (const asset of assets.data) {
      const assets2 = await axios.get(
        `${apiUrl}/assets/${asset.id}`,
        axiosOptions
      );

      // Confirmed there are no more asset-card references
      if (assets2.data.length !== 0) {
        try {
          await axios.delete(`${apiUrl}/assets/${asset.id}`, axiosOptions);
        } catch (error) {
          if (
            error.response.data.error.indexOf(
              'There are cards that reference'
            ) !== -1
          ) {
            logger.warn(
              'Card references remain, skipping delete of asset id' +
                ' ' +
                asset.id
            );
            continue;
          } else {
            logger.error(`Failed to delete asset ${asset.id}`);
            logger.error(error.message);
            throw error;
          }
        }
        logger.info(`Deleted asset id ${asset.id}`);
      }
    }
  };

  /**
   * Delete a card
   * @param {object} card
   * @return {Promise<void>}
   */
  const deleteCard = async (card) => {
    try {
      await axios.delete(`${apiUrl}/cards/${card.id}`, axiosOptions);
    } catch (error) {
      logger.error(`Failed to delete card ${card.id}`);
      logger.error(error.message);
      throw error;
    }

    logger.info(`Deleted card ${card.id}`);
  };

  if (args.deckName) {
    const deck = await getDeck(args.deckName);

    logger.verbose(JSON.stringify(deck));

    const cards = await getCards(deck.id);

    for (let i = 0; i < cards.length; i++) {
      await deleteCardAndAssets(cards[i]);
    }

    await axios.delete(`${apiUrl}/decks/${deck.id}`, axiosOptions);

    logger.info(`deck id ${deck.id} delete complete`);
  } else if (args.cardId) {
    // Get the card
    const card = await axios.get(
      `${apiUrl}/cards/${args.cardId}`,
      axiosOptions
    );

    await deleteCardAndAssets(card.data.data[0]);
  } else {
    throw new Error(
      'either deckName parameter or cardId parameter' + ' must be specified'
    );
  }
};

try {
  await runWrapper(callback);
} catch (error) {
  console.error(error.message);
  console.error(error.stack);
  process.exitCode = 1;
}
