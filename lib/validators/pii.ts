const emailRegex = /[\w.+-]+@[\w-]+\.[\w.-]+/i;
const phoneRegex = /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{3,4}\b/;

export const containsPii = (text: string) => {
  return emailRegex.test(text) || phoneRegex.test(text);
};
