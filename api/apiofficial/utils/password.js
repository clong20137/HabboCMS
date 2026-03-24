"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBcryptHash = isBcryptHash;
function isBcryptHash(hash) {
    return (hash.startsWith("$2a$") ||
        hash.startsWith("$2b$") ||
        hash.startsWith("$2y$"));
}
