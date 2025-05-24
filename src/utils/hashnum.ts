export function hashnum(username: string): string {
  const p = 31;
  let pow = 1;
  const N = 100000000;

  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash += (username.charCodeAt(i) * pow) % N;
    pow = (pow * p) % N;
  }

  const hash_str = hash.toString().padStart(8, "1");
  return hash_str;
}
