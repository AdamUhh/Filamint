import { UploadIcon, XIcon } from "lucide-react";
import React, { useState } from "react";
import {
    type DropzoneProps as _DropzoneProps,
    type DropzoneState as _DropzoneState,
    useDropzone,
} from "react-dropzone";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { formatBytesToMB } from "@/lib/util-format";
import { cn } from "@/lib/utils";

import type { TModelSchema } from "./lib/schema";

export type DropzoneState = _DropzoneState;

export interface DropzoneProps extends Omit<_DropzoneProps, "children"> {
    containerClassName?: string;
    dropZoneClassName?: string;
    children?: (dropzone: DropzoneState) => React.ReactNode;
    showFilesList?: boolean;
    value: TModelSchema[];
    onAdd: (file: File) => void;
    onDelete: (index: number) => void;
}

const formatErrorMessage = (message: string) =>
    message.replace(/(\d+) bytes/g, (_, bytes) =>
        formatBytesToMB(Number(bytes))
    );

export function Dropzone({
    containerClassName,
    dropZoneClassName,
    children,
    showFilesList = true,
    value,
    onDelete,
    onAdd,
    ...props
}: DropzoneProps) {
    const [errorMessage, setErrorMessage] = useState<string>();

    const dropzone = useDropzone({
        ...props,
        onDrop(acceptedFiles, fileRejections) {
            acceptedFiles.forEach(onAdd);

            if (!fileRejections.length) {
                setErrorMessage(undefined);
                return;
            }

            const rejectionMessages = fileRejections.map(({ file, errors }) => {
                const formattedErrors = errors
                    .map((e) => formatErrorMessage(e.message))
                    .join("\n");

                return `>${file.name} (${formattedErrors})`;
            });

            const errMessage =
                fileRejections.length === 1
                    ? `Failed to upload the following file:\n${rejectionMessages.join("\n")}`
                    : `Failed to upload the following files:\n${rejectionMessages.join("\n")}`;

            setErrorMessage(errMessage);
        },
    });

    return (
        <div className={cn("flex flex-col gap-2", containerClassName)}>
            <div
                {...dropzone.getRootProps()}
                className={cn(
                    "relative flex h-32 w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-200 transition-all select-none hover:bg-accent hover:text-accent-foreground",
                    dropZoneClassName
                )}
                data-file-drop-target
            >
                <input {...dropzone.getInputProps()} />
                {children ? (
                    children(dropzone)
                ) : dropzone.isDragAccept ? (
                    <div className="text-sm font-medium">
                        Drop your files here!
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-1.5">
                        <div className="flex flex-row items-center gap-0.5 text-sm font-medium">
                            <UploadIcon className="mr-2 h-4 w-4" /> Upload files
                        </div>
                        {props.maxSize && (
                            <div className="text-xs font-medium text-gray-400">
                                Max file size: {formatBytesToMB(props.maxSize)}{" "}
                                MB
                            </div>
                        )}

                        <div className="text-xs font-medium text-gray-400">
                            Accepts .3MF & .STL
                        </div>
                        {value.length > 0 && (
                            <Badge
                                variant="outline"
                                className="pointer-events-none absolute right-1 bottom-1 text-gray-600"
                            >
                                Total:{" "}
                                {formatBytesToMB(
                                    value.reduce((sum, v) => sum + v.size, 0)
                                )}{" "}
                                MB
                            </Badge>
                        )}
                    </div>
                )}
            </div>

            {errorMessage && (
                <span className="mt-3 text-sm wrap-break-word whitespace-pre-wrap text-red-600">
                    {errorMessage}
                </span>
            )}

            {showFilesList && value.length > 0 && (
                <div className="mt-2 flex w-full flex-col gap-2">
                    {value.map((fileUploaded, index) => {
                        const isFile = fileUploaded instanceof File;
                        return (
                            <Card
                                key={index}
                                className="group/content shadow-sm transition-shadow hover:shadow-md"
                            >
                                <CardContent className="flex px-4 py-0">
                                    <div className="flex w-full flex-row items-center gap-4 overflow-hidden">
                                        <div className="flex w-full flex-col gap-1 overflow-hidden">
                                            <div className="text-xs wrap-break-word capitalize">
                                                {isFile
                                                    ? fileUploaded.name
                                                          .split(".")
                                                          .slice(0, -1)
                                                          .join(".")
                                                    : fileUploaded.name}
                                            </div>
                                            <div className="flex h-6 w-full items-center justify-between">
                                                <div className="flex items-center gap-1.5">
                                                    <Badge
                                                        variant="secondary"
                                                        className="uppercase"
                                                    >
                                                        .
                                                        {isFile
                                                            ? fileUploaded.name
                                                                  .split(".")
                                                                  .pop()
                                                            : fileUploaded.ext}
                                                    </Badge>

                                                    <Badge variant="outline">
                                                        {formatBytesToMB(
                                                            fileUploaded.size
                                                        )}{" "}
                                                        MB
                                                    </Badge>
                                                </div>

                                                <Button
                                                    variant="ghost-destructive"
                                                    className="hidden size-6 p-2 group-hover/content:flex hover:text-destructive"
                                                    onClick={() =>
                                                        onDelete(index)
                                                    }
                                                >
                                                    <XIcon />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
