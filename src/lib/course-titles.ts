export const COURSE_TITLES: Record<string, string> = {
  CSE0613101: "Structured Programming Language",
  CSE0613102: "Structured Programming Language Lab",
  MAT0541101: "Differential & Integral Calculus",
  EEE0713201: "Electronics",
  EEE0714202: "Electronics Lab",
  GED0413201: "Entrepreneurship: Innovation and Commercialization",
  GED0222101: "Bangladesh Studies: History and Cultures",
  ENG0232101: "Communicative English",
  ENG0232102: "Communicative English Lab",
};

export function getCourseTitle(code: string): string | undefined {
  return COURSE_TITLES[code];
}
