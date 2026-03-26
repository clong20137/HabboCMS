"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeRichHtml = sanitizeRichHtml;
const BLOCKED_TAGS = [
    "script",
    "style",
    "iframe",
    "object",
    "embed",
    "form",
    "input",
    "button",
    "textarea",
    "select",
    "option",
    "link",
    "meta",
    "base",
];
const BLOCKED_TAGS_RE = new RegExp(`<\\/?(?:${BLOCKED_TAGS.join("|")})(?:\\s[^>]*)?>[\\s\\S]*?(?:<\\/(?:${BLOCKED_TAGS.join("|")})\\s*>|$)|<\\/?(?:${BLOCKED_TAGS.join("|")})(?:\\s[^>]*)?\\/?\\s*>`, "gi");
const EVENT_HANDLER_ATTR_RE = /\s+on[a-z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_URL_ATTR_RE = /\s+(href|src|xlink:href|formaction)\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*'|\s*javascript:[^\s>]+)/gi;
const DATA_HTML_ATTR_RE = /\s+(href|src|xlink:href|formaction)\s*=\s*("\s*data:text\/html[^"]*"|'\s*data:text\/html[^']*'|\s*data:text\/html[^\s>]+)/gi;
const INLINE_STYLE_RE = /\s+style\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const XMLNS_RE = /\s+xmlns(?::[a-z0-9_-]+)?\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const HTML_COMMENT_RE = /<!--([\s\S]*?)-->/g;
function sanitizeRichHtml(input) {
    const raw = String(input || "").trim();
    if (!raw)
        return "<p></p>";
    let html = raw;
    html = html.replace(HTML_COMMENT_RE, "");
    html = html.replace(BLOCKED_TAGS_RE, "");
    html = html.replace(EVENT_HANDLER_ATTR_RE, "");
    html = html.replace(JS_URL_ATTR_RE, " $1=\"#\"");
    html = html.replace(DATA_HTML_ATTR_RE, " $1=\"#\"");
    html = html.replace(INLINE_STYLE_RE, "");
    html = html.replace(XMLNS_RE, "");
    return html.trim() || "<p></p>";
}
