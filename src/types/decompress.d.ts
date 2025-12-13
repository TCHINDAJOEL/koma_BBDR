declare module 'decompress' {
  interface File {
    data: Buffer;
    mode: number;
    mtime: string;
    path: string;
    type: string;
  }

  interface DecompressOptions {
    filter?: (file: File) => boolean;
    map?: (file: File) => File;
    plugins?: any[];
    strip?: number;
  }

  function decompress(
    input: string | Buffer,
    output?: string,
    options?: DecompressOptions
  ): Promise<File[]>;

  export default decompress;
}

declare module 'decompress-unzip' {
  function decompressUnzip(): any;
  export default decompressUnzip;
}

declare module 'decompress-targz' {
  function decompressTargz(): any;
  export default decompressTargz;
}

declare module 'decompress-tarbz2' {
  function decompressTarbz2(): any;
  export default decompressTarbz2;
}

declare module 'decompress-tar' {
  function decompressTar(): any;
  export default decompressTar;
}
