"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toNewsImageUrl = toNewsImageUrl;
function toNewsImageUrl(imageFile) {
    const file = String(imageFile || "").trim();
    if (!file)
        return "";
    return `/assets/news/${file}`;
}
