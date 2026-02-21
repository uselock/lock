import OpenAI from 'openai';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  try {
    const response = await getClient().embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });

    return response.data[0].embedding;
  } catch {
    // Gracefully degrade if OpenAI key is invalid or API fails
    return null;
  }
}
