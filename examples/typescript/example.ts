interface Person { name: string }
export function greeting(person: Person): string {
  return `Hello, ${person.name}`;
}
