declare module "pretty-data" {
  export const pd: {
    xml: (xml: string) => string;
    json: (json: string) => string;
    css: (css: string) => string;
    sql: (sql: string) => string;
    xmlmin: (xml: string) => string;
    jsonmin: (json: string) => string;
    cssmin: (css: string) => string;
    sqlmin: (sql: string) => string;
  };
}
