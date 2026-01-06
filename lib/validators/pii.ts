const emailRegex = /[\w.+-]+@[\w-]+\.[\w.-]+/i;
const phoneRegex = /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{3,4}\b/;
const postcodeRegex = /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/i;
const dobRegex = /\b(?:dob|date of birth)\b[:\s]*\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/i;
const nameLabelRegex = /\b(name|student name)\b\s*[:#]/i;
const addressRegex = /\b(address|street|road|postcode|zip)\b\s*[:#]/i;
const studentIdRegex = /\b(student id|student number|pupil number|upn)\b\s*[:#]?\s*\w+/i;

export const containsPii = (text: string) => {
  return (
    emailRegex.test(text) ||
    phoneRegex.test(text) ||
    postcodeRegex.test(text) ||
    dobRegex.test(text) ||
    nameLabelRegex.test(text) ||
    addressRegex.test(text) ||
    studentIdRegex.test(text)
  );
};
