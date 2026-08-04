declare module "heic-decode" {
  function decode(input: {
    buffer: Buffer | ArrayBuffer | Uint8Array;
  }): Promise<{
    data: Uint8Array;
    width: number;
    height: number;
  }>;

  export default decode;
}
