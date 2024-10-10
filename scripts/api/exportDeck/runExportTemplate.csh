# Owner of the deck
DECK_OWNER=
# User for authentication
USER=
# Password for authentication
PASSWORD=
# Name of deck
DECK=


node scripts/api/exportDeck/export.mjs -p scripts/api --owner $DECK_OWNER  \
--deck $DECK --host www.hipocampo.com --user $USER \
--password $PASSWORD --port none --protocol https


