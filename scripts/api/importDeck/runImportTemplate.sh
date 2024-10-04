# NAME OF THE FOLDER CONTAINING THE IMPORT FILES (by default, it was the deck id when exporting)
DECK_ID=
# User for authentication
USER=
# Password for authentication
PASSWORD=


 node scripts/api/importDeck/import.mjs -p scripts/api \
  --user $USER --password $PASSWORD --host www.hipocampo.com \
  --oldDeckId $DECK_ID --port none --protocol https






