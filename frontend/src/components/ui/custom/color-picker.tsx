"use client";

// Source: https://github.com/vatsalpipalava/shadcn-input-color
//
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { HexColorPicker } from "react-colorful";
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

// Helpers
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

const colorSchema = z
    .string()
    .regex(
        /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/,
        "Color must be a valid hex color (e.g., #FF0000 or #FF0000FF)"
    )
    .transform((val) => val.toUpperCase());

interface ColorPickerProps {
    name: string;
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    isLoading?: boolean;
    error?: boolean;
    className?: string;
}

interface ColorValues {
    hex: string;
    rgb: { r: number; g: number; b: number };
    hsl: { h: number; s: number; l: number };
}

export function ColorPicker({
    name,
    value,
    onChange,
    onBlur,
    isLoading = false,
    error,
    className = "",
}: ColorPickerProps) {
    const [colorFormat, setColorFormat] = useState("HEX");
    const colorValues = useMemo<ColorValues>(() => {
        const rgb = hexToRgb(value);
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        return {
            hex: value.toUpperCase(),
            rgb,
            hsl,
        };
    }, [value]);

    // Keep hexInputValue state
    const [hexInputValue, setHexInputValue] = useState(value);
    const [hexInputError, setHexInputError] = useState<string | null>(null);

    useEffect(() => {
        setHexInputValue(value);
    }, [value]);

    // Handle color picker change
    const handleColorChange = (newColor: string) => {
        setHexInputValue(newColor.toUpperCase());
        onChange(newColor.toUpperCase());
    };

    // Handle HEX input change
    const handleHexChange = (value: string) => {
        let formattedValue = value.toUpperCase();
        if (!formattedValue.startsWith("#")) {
            formattedValue = "#" + formattedValue;
        }

        const maxLength = 7;
        if (
            formattedValue.length <= maxLength &&
            /^#[0-9A-Fa-f]*$/.test(formattedValue)
        ) {
            setHexInputValue(formattedValue);
            onChange(formattedValue); // This will update the parent, which will update colorValues via useMemo

            try {
                if (formattedValue.length === maxLength) {
                    colorSchema.parse(formattedValue);
                    setHexInputError(null);
                }
            } catch (validationError) {
                if (validationError instanceof z.ZodError) {
                    console.log("Enter a valid color");
                    setHexInputError("Enter a valid color");
                }
            }
        }
    };

    const handleRgbChange = (component: "r" | "g" | "b", value: string) => {
        const numValue = Number.parseInt(value) || 0;
        const clampedValue = Math.max(0, Math.min(255, numValue));
        const newRgb = { ...colorValues.rgb, [component]: clampedValue };
        const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);

        onChange(hex);
    };

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

        onChange(hex);
    };

    // Handle popover close
    const handlePopoverChange = (open: boolean) => {
        if (!open) {
            setColorFormat("HEX");
            onBlur?.();
        }
    };

    // Get current hex value for display
    const getCurrentHexValue = () => {
        if (colorFormat === "HEX") {
            return hexInputValue;
        }
        return colorValues.hex;
    };

    return (
        <div className={cn("w-full", className)}>
            <div className="flex w-full items-center gap-1">
                <Popover onOpenChange={handlePopoverChange}>
                    <PopoverTrigger asChild>
                        <Button
                            className="relative size-8 overflow-hidden border border-border shadow-none"
                            size={"icon"}
                            style={{ backgroundColor: hexInputValue }}
                        />
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-3" align="start">
                        <div className="color-picker space-y-3">
                            <div className="relative">
                                <HexColorPicker
                                    className="aspect-square! h-[244.79px]! w-[244.79px]!"
                                    color={value}
                                    onChange={handleColorChange}
                                />
                            </div>
                            <div className="flex gap-2">
                                <Select
                                    value={colorFormat}
                                    onValueChange={setColorFormat}
                                >
                                    <SelectTrigger className="h-7! w-[4.8rem]! rounded-sm px-2 py-1 text-sm!">
                                        <SelectValue placeholder="Color" />
                                    </SelectTrigger>
                                    <SelectContent className="min-w-20">
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
                                    </SelectContent>
                                </Select>
                                {colorFormat === "HEX" ? (
                                    <Input
                                        className="h-7 w-40 rounded-sm text-sm"
                                        value={getCurrentHexValue()}
                                        onChange={(e) =>
                                            handleHexChange(e.target.value)
                                        }
                                        placeholder={"#FF0000"}
                                        maxLength={7}
                                    />
                                ) : colorFormat === "RGB" ? (
                                    <div className="flex items-center">
                                        <Input
                                            className="h-7 w-13 rounded-l-sm rounded-r-none text-center text-sm"
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
                                ) : null}
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
                <div className="relative flex-1">
                    <Input
                        id={name}
                        name={name}
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
            {hexInputError && (
                <p className="mt-1.5 text-sm text-destructive">
                    {hexInputError}
                </p>
            )}
        </div>
    );
}
