"use client";

import { Loader2, PipetteIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { HexAlphaColorPicker, HexColorPicker } from "react-colorful";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { cn } from "@/lib/utils";

// Source: https://github.com/vatsalpipalava/shadcn-input-color

function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
              r: Number.parseInt(result[1], 16),
              g: Number.parseInt(result[2], 16),
              b: Number.parseInt(result[3], 16),
          }
        : { r: 0, g: 0, b: 0 };
}

function rgbToHex(r: number, g: number, b: number): string {
    return (
        "#" +
        ((1 << 24) + (r << 16) + (g << 8) + b)
            .toString(16)
            .slice(1)
            .toUpperCase()
    );
}

function rgbToHsl(
    r: number,
    g: number,
    b: number
): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            case b:
                h = (r - g) / d + 4;
                break;
        }
        h /= 6;
    }

    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100),
    };
}

function hslToRgb(
    h: number,
    s: number,
    l: number
): { r: number; g: number; b: number } {
    h /= 360;
    s /= 100;
    l /= 100;

    const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };

    let r, g, b;

    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255),
    };
}

// New alpha functions
function hexToRgba(hex: string): {
    r: number;
    g: number;
    b: number;
    a: number;
} {
    let cleanHex = hex.replace("#", "");

    if (cleanHex.length === 6) {
        cleanHex += "FF"; // Add full opacity if no alpha
    }

    if (cleanHex.length === 8) {
        return {
            r: Number.parseInt(cleanHex.slice(0, 2), 16),
            g: Number.parseInt(cleanHex.slice(2, 4), 16),
            b: Number.parseInt(cleanHex.slice(4, 6), 16),
            a: Number.parseInt(cleanHex.slice(6, 8), 16) / 255,
        };
    }

    return { r: 0, g: 0, b: 0, a: 1 };
}

function rgbaToHex(r: number, g: number, b: number, a: number): string {
    const alpha = Math.round(a * 255);
    return (
        "#" +
        ((1 << 24) + (r << 16) + (g << 8) + b)
            .toString(16)
            .slice(1)
            .toUpperCase() +
        alpha.toString(16).padStart(2, "0").toUpperCase()
    );
}

function rgbaToHsla(
    r: number,
    g: number,
    b: number,
    a: number
): { h: number; s: number; l: number; a: number } {
    const hsl = rgbToHsl(r, g, b);
    return { ...hsl, a };
}

function hslaToRgba(
    h: number,
    s: number,
    l: number,
    a: number
): { r: number; g: number; b: number; a: number } {
    const rgb = hslToRgb(h, s, l);
    return { ...rgb, a };
}

const colorSchema = z
    .string()
    .regex(
        /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/,
        "Color must be a valid hex color (e.g., #FF0000 or #FF0000FF)"
    )
    .transform((val) => val.toUpperCase());

interface ColorPickerProps {
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    isLoading?: boolean;
    label?: string;
    error?: string;
    className?: string;
    alpha?: boolean;
}

interface ColorValues {
    hex: string;
    rgb: { r: number; g: number; b: number };
    hsl: { h: number; s: number; l: number };
    rgba?: { r: number; g: number; b: number; a: number };
    hsla?: { h: number; s: number; l: number; a: number };
}

export function ColorPicker({
    value,
    onChange,
    onBlur,
    isLoading = false,
    label,
    error,
    className = "",
    alpha = false,
}: ColorPickerProps) {
    const [colorFormat, setColorFormat] = useState(alpha ? "HEXA" : "HEX");
    const [colorValues, setColorValues] = useState<ColorValues>(() => {
        if (alpha) {
            const rgba = hexToRgba(value);
            const hsla = rgbaToHsla(rgba.r, rgba.g, rgba.b, rgba.a);
            return {
                hex: value.length === 9 ? value.slice(0, 7) : value,
                rgb: { r: rgba.r, g: rgba.g, b: rgba.b },
                hsl: rgbToHsl(rgba.r, rgba.g, rgba.b),
                rgba,
                hsla,
            };
        } else {
            const rgb = hexToRgb(value);
            const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
            return {
                hex: value,
                rgb,
                hsl,
            };
        }
    });
    // Add a state to store the current HEX/HEXA input value
    const [hexInputValue, setHexInputValue] = useState(value);
    const [hexInputError, setHexInputError] = useState<string | null>(null);

    // Update all color formats when color changes
    const updateColorValues = (newColor: string) => {
        if (alpha) {
            const rgba = hexToRgba(newColor);
            const hsla = rgbaToHsla(rgba.r, rgba.g, rgba.b, rgba.a);
            setColorValues({
                hex: newColor.length === 9 ? newColor.slice(0, 7) : newColor,
                rgb: { r: rgba.r, g: rgba.g, b: rgba.b },
                hsl: rgbToHsl(rgba.r, rgba.g, rgba.b),
                rgba,
                hsla,
            });
            setHexInputValue(newColor.toUpperCase());
        } else {
            const rgb = hexToRgb(newColor);
            const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
            setColorValues({
                hex: newColor.toUpperCase(),
                rgb,
                hsl,
            });
            setHexInputValue(newColor.toUpperCase());
        }
    };

    // Handle color picker change
    const handleColorChange = (newColor: string) => {
        updateColorValues(newColor);
        onChange(newColor);
    };

    // Handle HEX input change
    const handleHexChange = (value: string) => {
        let formattedValue = value.toUpperCase();
        if (!formattedValue.startsWith("#")) {
            formattedValue = "#" + formattedValue;
        }

        const maxLength = alpha ? 9 : 7;
        if (
            formattedValue.length <= maxLength &&
            /^#[0-9A-Fa-f]*$/.test(formattedValue)
        ) {
            setHexInputValue(formattedValue); // Always update the input value
            // Update color and color values for any valid partial hex
            onChange(formattedValue);
            updateColorValues(formattedValue);
            try {
                if (formattedValue.length === maxLength) {
                    // Only validate when full length
                    colorSchema.parse(formattedValue);
                    // Already updated above
                    setHexInputError(null);
                } else {
                    // Not full length, so log
                    console.log("Enter a valid color");
                    setHexInputError("Enter a valid color");
                }
            } catch (validationError) {
                if (validationError instanceof z.ZodError) {
                    // Do not update color, just keep the input value
                    console.log("Enter a valid color");
                    setHexInputError("Enter a valid color");
                }
            }
        }
    };

    // Handle RGB input change
    const handleRgbChange = (component: "r" | "g" | "b", value: string) => {
        const numValue = Number.parseInt(value) || 0;
        const clampedValue = Math.max(0, Math.min(255, numValue));
        const newRgb = { ...colorValues.rgb, [component]: clampedValue };
        const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
        const hsl = rgbToHsl(newRgb.r, newRgb.g, newRgb.b);

        setColorValues({ ...colorValues, hex, rgb: newRgb, hsl });
        onChange(hex);
    };

    // Handle RGBA input change
    const handleRgbaChange = (
        component: "r" | "g" | "b" | "a",
        value: string
    ) => {
        if (!alpha || !colorValues.rgba) return;

        const numValue = Number.parseFloat(value) || 0;
        let clampedValue;

        if (component === "a") {
            clampedValue = Math.max(0, Math.min(1, numValue));
        } else {
            clampedValue = Math.max(0, Math.min(255, Math.floor(numValue)));
        }

        const newRgba = { ...colorValues.rgba, [component]: clampedValue };
        const hex = rgbaToHex(newRgba.r, newRgba.g, newRgba.b, newRgba.a);
        const hsla = rgbaToHsla(newRgba.r, newRgba.g, newRgba.b, newRgba.a);

        setColorValues({
            ...colorValues,
            hex: hex.slice(0, 7),
            rgb: { r: newRgba.r, g: newRgba.g, b: newRgba.b },
            hsl: rgbToHsl(newRgba.r, newRgba.g, newRgba.b),
            rgba: newRgba,
            hsla,
        });
        onChange(hex);
    };

    // Handle HSL input change
    const handleHslChange = (component: "h" | "s" | "l", value: string) => {
        const numValue = Number.parseInt(value) || 0;
        let clampedValue;
        if (component === "h") {
            clampedValue = Math.max(0, Math.min(360, numValue));
        } else {
            clampedValue = Math.max(0, Math.min(100, numValue));
        }
        const newHsl = { ...colorValues.hsl, [component]: clampedValue };
        const rgb = hslToRgb(newHsl.h, newHsl.s, newHsl.l);
        const hex = rgbToHex(rgb.r, rgb.g, rgb.b);

        setColorValues({ ...colorValues, hex, rgb, hsl: newHsl });
        onChange(hex);
    };

    // Handle HSLA input change
    const handleHslaChange = (
        component: "h" | "s" | "l" | "a",
        value: string
    ) => {
        if (!alpha || !colorValues.hsla) return;

        const numValue = Number.parseFloat(value) || 0;
        let clampedValue;

        if (component === "a") {
            clampedValue = Math.max(0, Math.min(1, numValue));
        } else if (component === "h") {
            clampedValue = Math.max(0, Math.min(360, numValue));
        } else {
            clampedValue = Math.max(0, Math.min(100, numValue));
        }

        const newHsla = { ...colorValues.hsla, [component]: clampedValue };
        const rgba = hslaToRgba(newHsla.h, newHsla.s, newHsla.l, newHsla.a);
        const hex = rgbaToHex(rgba.r, rgba.g, rgba.b, rgba.a);

        setColorValues({
            ...colorValues,
            hex: hex.slice(0, 7),
            rgb: { r: rgba.r, g: rgba.g, b: rgba.b },
            hsl: { h: newHsla.h, s: newHsla.s, l: newHsla.l },
            rgba,
            hsla: newHsla,
        });
        onChange(hex);
    };

    // Handle popover close
    const handlePopoverChange = (open: boolean) => {
        if (!open) {
            setColorFormat(alpha ? "HEXA" : "HEX");
            onBlur?.();
        }
    };

    // Check if EyeDropper API is available
    const isEyeDropperAvailable = () => {
        return typeof window !== "undefined" && "EyeDropper" in window;
    };

    // Handle eyedropper click
    const handleEyeDropper = async () => {
        if (!isEyeDropperAvailable()) {
            alert("Eyedropper is not supported in your browser");
            return;
        }
        try {
            // @ts-expect-error - TypeScript doesn't have types for EyeDropper yet
            const eyeDropper = new window.EyeDropper();
            const result = await eyeDropper.open();
            const pickedColor = result.sRGBHex;
            updateColorValues(pickedColor);
            onChange(pickedColor);
        } catch {
            console.log("User canceled the eyedropper");
        }
    };

    // Initialize color values on mount and when value changes from outside
    useEffect(() => {
        updateColorValues(value);
        setHexInputValue(value.toUpperCase());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    // Get current hex value for display
    const getCurrentHexValue = () => {
        if (colorFormat === "HEX" || colorFormat === "HEXA") {
            return hexInputValue;
        }
        if (alpha && colorValues.rgba) {
            return rgbaToHex(
                colorValues.rgba.r,
                colorValues.rgba.g,
                colorValues.rgba.b,
                colorValues.rgba.a
            );
        }
        return colorValues.hex;
    };

    return (
        <div className={cn("w-full", className)}>
            {/* <Label className="mb-3">{label}</Label> */}
            <div className="flex w-full items-center gap-1">
                <Popover onOpenChange={handlePopoverChange}>
                    <PopoverTrigger asChild>
                        <Button
                            className="relative size-8 overflow-hidden border border-border shadow-none"
                            size={"icon"}
                            style={{ backgroundColor: hexInputValue }}
                        >
                            {alpha &&
                                colorValues.rgba &&
                                colorValues.rgba.a < 1 && (
                                    <div
                                        className="absolute inset-0 opacity-20"
                                        style={{
                                            backgroundImage: `linear-gradient(45deg, #ccc 25%, transparent 25%), 
                                    linear-gradient(-45deg, #ccc 25%, transparent 25%), 
                                    linear-gradient(45deg, transparent 75%, #ccc 75%), 
                                    linear-gradient(-45deg, transparent 75%, #ccc 75%)`,
                                            backgroundSize: "8px 8px",
                                            backgroundPosition:
                                                "0 0, 0 4px, 4px -4px, -4px 0px",
                                        }}
                                    />
                                )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-3" align="start">
                        <div className="color-picker space-y-3">
                            <div className="relative">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute -top-1.5 -left-1 z-10 flex h-7 w-7 items-center gap-1 bg-transparent hover:bg-transparent"
                                    onClick={handleEyeDropper}
                                    disabled={!isEyeDropperAvailable()}
                                >
                                    <PipetteIcon className="h-3 w-3" />
                                </Button>
                                {alpha ? (
                                    <HexAlphaColorPicker
                                        className="!aspect-square !h-[244.79px] !w-[244.79px]"
                                        color={value}
                                        onChange={handleColorChange}
                                    />
                                ) : (
                                    <HexColorPicker
                                        className="!aspect-square !h-[244.79px] !w-[244.79px]"
                                        color={value}
                                        onChange={handleColorChange}
                                    />
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Select
                                    value={colorFormat}
                                    onValueChange={setColorFormat}
                                >
                                    <SelectTrigger className="!h-7 !w-[4.8rem] rounded-sm px-2 py-1 !text-sm">
                                        <SelectValue placeholder="Color" />
                                    </SelectTrigger>
                                    <SelectContent className="min-w-20">
                                        {alpha ? (
                                            <>
                                                <SelectItem
                                                    value="HEXA"
                                                    className="h-7 text-sm"
                                                >
                                                    HEXA
                                                </SelectItem>
                                                <SelectItem
                                                    value="RGBA"
                                                    className="h-7 text-sm"
                                                >
                                                    RGBA
                                                </SelectItem>
                                                <SelectItem
                                                    value="HSLA"
                                                    className="h-7 text-sm"
                                                >
                                                    HSLA
                                                </SelectItem>
                                            </>
                                        ) : (
                                            <>
                                                <SelectItem
                                                    value="HEX"
                                                    className="h-7 text-sm"
                                                >
                                                    HEX
                                                </SelectItem>
                                                <SelectItem
                                                    value="RGB"
                                                    className="h-7 text-sm"
                                                >
                                                    RGB
                                                </SelectItem>
                                                <SelectItem
                                                    value="HSL"
                                                    className="h-7 text-sm"
                                                >
                                                    HSL
                                                </SelectItem>
                                            </>
                                        )}
                                    </SelectContent>
                                </Select>
                                {colorFormat === "HEX" ||
                                colorFormat === "HEXA" ? (
                                    <Input
                                        className="h-5 w-[160px] rounded-sm text-sm"
                                        value={getCurrentHexValue()}
                                        onChange={(e) =>
                                            handleHexChange(e.target.value)
                                        }
                                        placeholder={
                                            alpha ? "#FF0000FF" : "#FF0000"
                                        }
                                        maxLength={alpha ? 9 : 7}
                                    />
                                ) : colorFormat === "RGB" ? (
                                    <div className="flex items-center">
                                        <Input
                                            className="h-5 w-13 rounded-l-sm rounded-r-none text-center text-sm"
                                            value={colorValues.rgb.r}
                                            onChange={(e) =>
                                                handleRgbChange(
                                                    "r",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="255"
                                            maxLength={3}
                                        />
                                        <Input
                                            className="h-7 w-13 rounded-none border-x-0 text-center text-sm"
                                            value={colorValues.rgb.g}
                                            onChange={(e) =>
                                                handleRgbChange(
                                                    "g",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="255"
                                            maxLength={3}
                                        />
                                        <Input
                                            className="h-7 w-13 rounded-l-none rounded-r-sm text-center text-sm"
                                            value={colorValues.rgb.b}
                                            onChange={(e) =>
                                                handleRgbChange(
                                                    "b",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="255"
                                            maxLength={3}
                                        />
                                    </div>
                                ) : colorFormat === "RGBA" &&
                                  alpha &&
                                  colorValues.rgba ? (
                                    <div className="flex items-center">
                                        <Input
                                            className="h-7 w-10 rounded-l-sm rounded-r-none px-1 text-center text-sm"
                                            value={colorValues.rgba.r}
                                            onChange={(e) =>
                                                handleRgbaChange(
                                                    "r",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="255"
                                            maxLength={3}
                                        />
                                        <Input
                                            className="h-7 w-10 rounded-none border-x-0 px-1 text-center text-sm"
                                            value={colorValues.rgba.g}
                                            onChange={(e) =>
                                                handleRgbaChange(
                                                    "g",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="255"
                                            maxLength={3}
                                        />
                                        <Input
                                            className="h-7 w-10 rounded-none border-x-0 px-1 text-center text-sm"
                                            value={colorValues.rgba.b}
                                            onChange={(e) =>
                                                handleRgbaChange(
                                                    "b",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="255"
                                            maxLength={3}
                                        />
                                        <Input
                                            className="h-7 w-10 rounded-l-none rounded-r-sm px-1 text-center text-sm"
                                            value={colorValues.rgba.a.toFixed(
                                                2
                                            )}
                                            onChange={(e) =>
                                                handleRgbaChange(
                                                    "a",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="1.00"
                                            maxLength={4}
                                        />
                                    </div>
                                ) : colorFormat === "HSL" ? (
                                    <div className="flex items-center">
                                        <Input
                                            className="h-7 w-13 rounded-l-sm rounded-r-none text-center text-sm"
                                            value={colorValues.hsl.h}
                                            onChange={(e) =>
                                                handleHslChange(
                                                    "h",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="360"
                                            maxLength={3}
                                        />
                                        <Input
                                            className="h-7 w-13 rounded-none border-x-0 text-center text-sm"
                                            value={colorValues.hsl.s}
                                            onChange={(e) =>
                                                handleHslChange(
                                                    "s",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="100"
                                            maxLength={3}
                                        />
                                        <Input
                                            className="h-7 w-13 rounded-l-none rounded-r-sm text-center text-sm"
                                            value={colorValues.hsl.l}
                                            onChange={(e) =>
                                                handleHslChange(
                                                    "l",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="100"
                                            maxLength={3}
                                        />
                                    </div>
                                ) : colorFormat === "HSLA" &&
                                  alpha &&
                                  colorValues.hsla ? (
                                    <div className="flex items-center">
                                        <Input
                                            className="h-7 w-10 rounded-l-sm rounded-r-none px-1 text-center text-sm"
                                            value={colorValues.hsla.h}
                                            onChange={(e) =>
                                                handleHslaChange(
                                                    "h",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="360"
                                            maxLength={3}
                                        />
                                        <Input
                                            className="h-7 w-10 rounded-none border-x-0 px-1 text-center text-sm"
                                            value={colorValues.hsla.s}
                                            onChange={(e) =>
                                                handleHslaChange(
                                                    "s",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="100"
                                            maxLength={3}
                                        />
                                        <Input
                                            className="h-7 w-10 rounded-none border-x-0 px-1 text-center text-sm"
                                            value={colorValues.hsla.l}
                                            onChange={(e) =>
                                                handleHslaChange(
                                                    "l",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="100"
                                            maxLength={3}
                                        />
                                        <Input
                                            className="h-7 w-10 rounded-l-none rounded-r-sm px-1 text-center text-sm"
                                            value={colorValues.hsla.a.toFixed(
                                                2
                                            )}
                                            onChange={(e) =>
                                                handleHslaChange(
                                                    "a",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="1.00"
                                            maxLength={4}
                                        />
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
                <div className="relative flex-1">
                    <Input
                        placeholder={label}
                        value={getCurrentHexValue()}
                        onChange={(e) => handleHexChange(e.target.value)}
                        onBlur={onBlur}
                        className={`h-8 uppercase ${error ? "border-destructive" : ""}`}
                    />
                    {isLoading && (
                        <span className="absolute inset-y-0 right-0 flex items-center pr-4">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </span>
                    )}
                </div>
            </div>
            {error && (
                <p className="mt-1.5 text-sm text-destructive">{error}</p>
            )}
            {hexInputError && (
                <p className="mt-1.5 text-sm text-destructive">
                    {hexInputError}
                </p>
            )}
        </div>
    );
}
