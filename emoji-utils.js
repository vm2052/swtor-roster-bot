// emoji-utils.js - Emoji validation utilities

// Common Discord emojis that are safe to use
const SAFE_EMOJIS = new Set([
    '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤',
    '📋', '📁', '📂', '🗂️', '📌', '📍', '🎯', '⭐', '🌟',
    '💫', '✨', '⚡', '🔥', '💧', '❄️', '🌊', '🌪️', '🌈',
    '☀️', '☁️', '⛅', '🌀', '🌌', '🌠', '🎖️', '🏆', '🥇',
    '✅', '❌', '⚠️', '🚫', '🔞', '📢', '🔔', '🔕', '💬',
    '➕', '✖️', '➖', '🔍', '🔎', '⚙️', '🔧', '🔨', '🛠️',
    '📝', '✏️', '📎', '🖇️', '📏', '📐', '✂️', '🔒', '🔓',
    '🔐', '🔑', '🗝️', '📅', '📆', '📊', '📈', '📉', '📋'
]);

// Regex for Unicode emoji validation
const EMOJI_REGEX = /\p{Emoji}/u;

// Regex for custom Discord emoji format
const CUSTOM_EMOJI_REGEX = /^<a?:\w+:\d+>$/;

/**
 * Validates if an emoji is acceptable for Discord
 * @param {string} emoji - The emoji to validate
 * @returns {boolean} - True if valid
 */
function isValidEmoji(emoji) {
    if (!emoji || typeof emoji !== 'string') return false;
    
    const trimmed = emoji.trim();
    if (trimmed.length === 0) return false;
    
    // Check if it's in our safe list
    if (SAFE_EMOJIS.has(trimmed)) return true;
    
    // Check for custom Discord emoji format
    if (CUSTOM_EMOJI_REGEX.test(trimmed)) return true;
    
    // Check if it's a Unicode emoji
    if (EMOJI_REGEX.test(trimmed)) {
        // Additional check for multiple character emojis (like flags)
        return true;
    }
    
    return false;
}

/**
 * Sanitizes and validates emoji input
 * @param {string} emoji - The emoji to sanitize
 * @param {string} defaultValue - Default emoji if invalid
 * @returns {string} - Valid emoji or default
 */
function sanitizeEmoji(emoji, defaultValue = '📋') {
    if (!emoji) return defaultValue;
    
    const trimmed = emoji.trim();
    
    // Check if it's a valid emoji
    if (isValidEmoji(trimmed)) {
        return trimmed;
    }
    
    // Log warning for debugging
    console.warn(`⚠️ Invalid emoji detected: "${trimmed}", using default "${defaultValue}"`);
    
    return defaultValue;
}

/**
 * Creates a select menu option with validated emoji
 * @param {string} label - Option label
 * @param {string} value - Option value
 * @param {string} emoji - Optional emoji
 * @returns {Object} - Formatted option object
 */
function createOption(label, value, emoji = null) {
    const option = { label, value };
    
    if (emoji && isValidEmoji(emoji)) {
        option.emoji = emoji;
    }
    
    return option;
}

/**
 * Validates and fixes emojis in branches array
 * @param {Array} branches - Array of branch objects
 * @returns {Array} - Branches with validated emojis
 */
function validateBranchEmojis(branches) {
    return branches.map(branch => {
        if (!isValidEmoji(branch.emoji)) {
            console.warn(`⚠️ Branch "${branch.name}" has invalid emoji "${branch.emoji}", using default`);
            branch.emoji = '📋';
        }
        return branch;
    });
}

module.exports = {
    isValidEmoji,
    sanitizeEmoji,
    createOption,
    validateBranchEmojis,
    SAFE_EMOJIS
};