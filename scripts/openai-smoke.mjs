import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is required');
}

const model = process.env.OPENAI_TEXT_MODEL ?? 'gpt-5.4-mini';
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const response = await client.responses.create({
  model,
  store: false,
  input: 'Return a successful readiness check.',
  text: {
    format: {
      type: 'json_schema',
      name: 'readiness_check',
      strict: true,
      schema: {
        type: 'object',
        properties: { ready: { type: 'boolean' } },
        required: ['ready'],
        additionalProperties: false,
      },
    },
  },
});

const result = JSON.parse(response.output_text);
if (result.ready !== true) {
  throw new Error('OpenAI returned an unexpected readiness result');
}

console.log(`OpenAI structured output verified with ${model}`);
