declare module "heic-decode" {
  export default function decode(input: { buffer: Buffer | Uint8Array }): Promise<{
    width: number;
    height: number;
    data: Uint8ClampedArray;
  }>;
}
