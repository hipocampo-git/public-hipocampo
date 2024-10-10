OPENAI_API_KEY=Fill_me_in

curl https://api.openai.com/v1/completions \
-H "Content-Type: application/json" \
-H "Authorization: Bearer $OPENAI_API_KEY" \
-d '{"model": "text-davinci-003", "prompt": "Generate a list of flashcards with english translations using the subjunctive tense", "temperature": 0, "max_tokens": 500}'

# curl https://api.openai.com/v1/images/generations \
#   -H 'Content-Type: application/json' \
#   -H 'Authorization: Bearer $OPENAI_API_KEY' \
#   -d '{
#   "prompt": "buffelgrass",
#   "n": 5,
#   "size": "1024x1024"
# }'
