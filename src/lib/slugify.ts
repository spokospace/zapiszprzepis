export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-ząćęłńóśźż0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100)
}
