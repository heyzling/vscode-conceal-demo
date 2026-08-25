type Handler = (input: string) => number;

const lengthOf: Handler = (input) => input.length;

const apply = (handler: Handler) => (value: string) => handler(value);

export const run = () => apply(lengthOf)("conceal");
