export const formatBytesToMB = (bytes: number): string =>
    (bytes / (1024 * 1024)).toFixed(2);

export const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const tryParseJson = (str: string) => {
    try {
        return JSON.parse(str);
    } catch {
        return null;
    }
};

export const toErrorMessage = (err: unknown): string => {
    if (err instanceof Error) {
        return tryParseJson(err.message)?.message ?? err.message;
    }
    return String(err);
};

// 2 decimal places max
export const formatGrams = (num: number) => {
    return Math.round(num * 100) / 100 || 0;
};
