// Map to store the last used gif for each interaction type
const lastUsedGifs = new Map<string, string>();

/**
 * Gets a random gif from the provided array, ensuring it's not the same as the last used gif
 * for the given interaction type (unless there's only one gif available)
 */
export function getRandomGif(interactionType: string, availableGifs: string[]): string {
  // If only one gif is available, return it
  if (availableGifs.length <= 1) {
    return availableGifs[0];
  }

  const lastUsedGif = lastUsedGifs.get(interactionType);
  let randomGif: string;

  // Keep selecting a random gif until we get one that's different from the last used
  do {
    randomGif = availableGifs[Math.floor(Math.random() * availableGifs.length)];
  } while (randomGif === lastUsedGif && availableGifs.length > 1);

  // Store this gif as the last used one for this interaction type
  lastUsedGifs.set(interactionType, randomGif);

  return randomGif;
}
