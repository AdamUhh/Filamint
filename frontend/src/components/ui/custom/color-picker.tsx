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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

const MAX_HEX_LENGTH = 7;

const FILAMENT_SWATCHES = [
    // WHITES & NEUTRALS
    { name: "Bambu Lab - Matte Ivory White PLA", hex: "#EBEBE3" },
    { name: "Bambu Lab - White PETG-HF", hex: "#F0F1F0" },
    { name: "Bambu Lab - Marble White PLA", hex: "#DBDDDC" },

    // GRAYS & BLACKS
    { name: "Bambu Lab - Gray PETG-HF", hex: "#A3A6A6" },
    { name: "Bambu Lab - Grey PLA Basic", hex: "#8B9398" },
    { name: "Bambu Lab - Dark Gray PLA Basic", hex: "#616364" },
    { name: "Bambu Lab - Charcoal PLA Matte", hex: "#424344" },
    { name: "Bambu Lab - Black PLA", hex: "#3D3D3C" },

    // REDS & PINKS
    { name: "Bambu Lab - Red PLA", hex: "#C13A3D" },
    { name: "Bambu Lab - Dark Red PLA Matte", hex: "#AF4749" },
    { name: "Bambu Lab - Burgundy Red Carbon Fiber PLA", hex: "#814348" },
    { name: "Bambu Lab - Pink PLA", hex: "#FF7896" },
    { name: "Bambu Lab - Matte Sakura Pink PLA", hex: "#EAB8CA" },
    { name: "Bambu Lab - Matte Plum PLA Matte", hex: "#9A3F63" },

    // ORANGES & YELLOWS
    { name: "Bambu Lab - Orange PLA Basic", hex: "#F07745" },
    { name: "Bambu Lab - Mandarin Orange PLA Matte", hex: "#FC9257" },
    { name: "Bambu Lab - Yellow PLA", hex: "#FDD803" },
    { name: "Bambu Lab - Lemon Yellow PLA Matte", hex: "#FFC968" },

    // GREENS
    { name: "Bambu Lab - Bambu Green PLA", hex: "#00A553" },
    { name: "Bambu Lab - Grass Green PLA Matte", hex: "#76B56F" },
    { name: "Bambu Lab - Mistletoe Green PLA", hex: "#2E7759" },
    { name: "Bambu Lab - Alpine Green PLA", hex: "#4D6359" },
    { name: "Bambu Lab - Dark Green PLA Matte", hex: "#656A4D" },

    // BLUES
    { name: "Bambu Lab - Cyan PLA", hex: "#009ACE" },
    { name: "Bambu Lab - Blue PLA Basic", hex: "#23529A" },
    { name: "Bambu Lab - Marine Blue PLA Matte", hex: "#287FAC" },
    { name: "Bambu Lab - Ice Blue PLA Matte", hex: "#9FD7E1" },
    { name: "Bambu Lab - Blue Grey PLA Basic", hex: "#647988" },
    { name: "Bambu Lab - Cobalt Blue Metallic PLA Metal", hex: "#5F8192" },

    // PURPLES
    { name: "Bambu Lab - Purple PLA Basic", hex: "#6B6FB2" },
    { name: "Bambu Lab - Lilac Purple PLA Matte", hex: "#9389C2" },
    { name: "Bambu Lab - Magenta PLA", hex: "#C55498" },
    { name: "Bambu Lab - Violet Purple PETG Carbon Fiber", hex: "#604F73" },

    // BROWNS & METALLIC
    { name: "Bambu Lab - Brown PLA", hex: "#9A6152" },
    { name: "Bambu Lab - Matte Latte Brown PLA", hex: "#BF9E82" },
    { name: "Bambu Lab - Bronze PLA", hex: "#867254" },
    { name: "Bambu Lab - Iridium Gold Metallic PLA Metal", hex: "#AC9E8E" },
];

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
        onChange(newColor.toUpperCase());
    };

    const handleSwatchClick = (swatchHex: string) => {
        onChange(swatchHex);
    };

    // Handle HEX input change
    const handleHexChange = (value: string) => {
        let formattedValue = value.toUpperCase();
        if (!formattedValue.startsWith("#")) {
            formattedValue = "#" + formattedValue;
        }

        if (
            formattedValue.length <= MAX_HEX_LENGTH &&
            /^#[0-9A-Fa-f]*$/.test(formattedValue)
        ) {
            onChange(formattedValue);

            if (formattedValue.length === MAX_HEX_LENGTH) {
                try {
                    colorSchema.parse(formattedValue);
                    setHexInputError(null);
                } catch {
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
                        <Tabs defaultValue="gradient" className="w-full">
                            <TabsList className="mb-3 grid w-full grid-cols-2">
                                <TabsTrigger value="gradient">
                                    Gradient
                                </TabsTrigger>
                                <TabsTrigger value="swatches">
                                    Swatches
                                </TabsTrigger>
                            </TabsList>
                            <TabsContent value="gradient" className="mt-0">
                                <div className="color-picker space-y-3">
                                    <div className="relative">
                                        <HexColorPicker
                                            className="aspect-square! size-61.25!"
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
                                                value={hexInputValue}
                                                onChange={(e) =>
                                                    handleHexChange(
                                                        e.target.value
                                                    )
                                                }
                                                placeholder={"#FF0000"}
                                                maxLength={MAX_HEX_LENGTH}
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
                            </TabsContent>
                            <TabsContent value="swatches" className="mt-0">
                                <div className="size-61.25! overflow-y-auto p-1">
                                    <div className="flex flex-wrap gap-2">
                                        {FILAMENT_SWATCHES.map((swatch) => (
                                            <Button
                                                key={swatch.hex}
                                                type="button"
                                                onClick={() =>
                                                    handleSwatchClick(
                                                        swatch.hex
                                                    )
                                                }
                                                className={cn(
                                                    "size-6 rounded shadow transition-all hover:scale-110",
                                                    value.toUpperCase() ===
                                                        swatch.hex
                                                        ? "ring-1 ring-primary"
                                                        : ""
                                                )}
                                                style={{
                                                    backgroundColor: swatch.hex,
                                                }}
                                                title={swatch.name}
                                                aria-label={`Select ${swatch.name} (${swatch.hex})`}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <p className="text-xs break-all whitespace-pre-line">
                                    Need more colors?{" "}
                                    <a
                                        href="https://filamentcolors.xyz/library/"
                                        className="text-blue-600 hover:underline"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Filament Colors library
                                    </a>
                                </p>
                            </TabsContent>
                        </Tabs>
                    </PopoverContent>
                </Popover>
                <div className="relative flex-1">
                    <Input
                        id={name}
                        name={name}
                        value={hexInputValue}
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
