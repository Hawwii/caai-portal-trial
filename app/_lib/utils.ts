export const countWordsInHTML = (html: string): number => {
  // Count the number of words (little hacky)
  const htmlWithSpaces = html.replace(/<div>/g, " ").replace(/<\/div>/g, " ").replace(/<br>/g, " ");
  const div = document.createElement("div");
  div.innerHTML = htmlWithSpaces;
  const textWithSpaces = div.innerText;
  const words = textWithSpaces.split(" ").filter(word => word !== "");

  return words.length;
};