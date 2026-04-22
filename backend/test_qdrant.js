import { QdrantClient } from '@qdrant/js-client-rest';
const qdrant = new QdrantClient({ url: 'http://localhost:6333' });
async function run() {
  try {
    await qdrant.createCollection('test_collection2', { vectors: { size: 1536, distance: 'Cosine' } });
    console.log("Success");
  } catch (err) {
    console.error(err);
    if (err.response) {
      console.error(await err.response.text());
    }
  }
}
run();
