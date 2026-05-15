export declare class CryptoService {
    private readonly algorithm;
    private readonly key;
    constructor();
    encrypt(plaintext: string): string;
    decrypt(token: string): string;
}
