import React, { useState } from "react";
import { useSpineStore } from "@/store/spine-store";
import {
  BugIcon,
  CameraIcon,
  Check,
  ChevronsUpDown,
  DownloadIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

import { SpineControls } from "./app-sidebar";

const SpineControlPanel: React.FC<SpineControls> = (controls) => {
  const [height, setHeight] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [customHeightEnabled, setCustomHeightEnabled] =
    useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);
  const [selectedAnimation, setSelectedAnimation] = useState<number>(0);

  const {
    spine,
    isLoading: isExporting,
    setIsLoading: setIsExporting,
  } = useSpineStore();

  const isSpineLoaded = !!spine;

  const togglePlayback = () => {
    if (!spine) return;

    if (isPlaying) {
      spine.state.timeScale = 0;
    } else {
      spine.state.timeScale = 1;
    }

    setIsPlaying(!isPlaying);
  };

  const toggleDebugMode = () => {
    if (!spine) return;
    controls.toggleDebugMode();
  };

  const handleAnimationSelect = (index: number) => {
    if (!spine || index === selectedAnimation) return;

    controls.playAnimation(index);
    setSelectedAnimation(index);
    setOpen(false);
  };

  const handleExport = async (
    format: "gif" | "webm" | "mp4" | "screenshot",
  ) => {
    if (!spine) return;

    if (customHeightEnabled) {
      const heightValue = parseInt(height);
      if (isNaN(heightValue) || heightValue <= 0) {
        toast("Invalid height", {
          description: "Please enter a positive number",
        });
        return;
      }
    }

    try {
      setIsExporting(true);
      const options = customHeightEnabled
        ? { height: parseInt(height) }
        : undefined;

      switch (format) {
        case "gif":
          await controls.exportToGif(options);
          break;
        case "mp4":
          await controls.exportToVideo("mp4", options);
          break;
        case "webm":
          await controls.exportToVideo("webm", options);
          break;
        case "screenshot":
          await controls.takeScreenshot();
          break;
      }
    } catch (error) {
      console.error(`Error with ${format}:`, error);
      toast(`Operation Failed`, {
        description: `Could not complete ${format === "screenshot" ? "screenshot" : `export as ${format.toUpperCase()}`}`,
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col space-y-3">
      <div className="space-y-1">
        <Label htmlFor="animation-selector" className="text-xs font-medium">
          Animation
        </Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild disabled={isExporting || !isSpineLoaded}>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
            >
              {controls.animationList[selectedAnimation] ??
                "Select animation..."}
              <ChevronsUpDown className="opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popper-anchor-width,200px)] p-0">
            <Command>
              <CommandInput placeholder="Search animation..." className="h-9" />
              <CommandList>
                <CommandEmpty>No animation found.</CommandEmpty>
                <CommandGroup>
                  {controls.animationList.map((animation, i) => (
                    <CommandItem
                      // eslint-disable-next-line react-x/no-array-index-key
                      key={`${animation}${i}`}
                      value={animation}
                      onSelect={() => {
                        handleAnimationSelect(i);
                        setOpen(false);
                      }}
                    >
                      {animation}
                      <Check
                        className={cn(
                          "ml-auto",
                          selectedAnimation === i ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Custom Height Option */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="custom-height"
          checked={customHeightEnabled}
          onCheckedChange={(checked) =>
            setCustomHeightEnabled(checked as boolean)
          }
          disabled={isExporting || !isSpineLoaded}
        />
        <Label
          htmlFor="custom-height"
          className="text-xs leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Export custom height
        </Label>
      </div>

      {/* Height Input */}
      {customHeightEnabled && (
        <div className="space-y-1">
          <Input
            id="height"
            type="number"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            className="h-7 text-xs"
            placeholder="Height in pixels"
            min="1"
            disabled={isExporting || !isSpineLoaded}
          />
        </div>
      )}

      {/* Export Buttons */}
      <div className="grid grid-cols-2 gap-1">
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          disabled={isExporting || !isSpineLoaded}
          onClick={() => void handleExport("gif")}
        >
          <DownloadIcon className="mr-1 h-3 w-3" />
          GIF
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          disabled={isExporting || !isSpineLoaded}
          onClick={() => void handleExport("screenshot")}
        >
          <CameraIcon className="mr-1 h-3 w-3" />
          SS
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          disabled={isExporting || !isSpineLoaded}
          onClick={() => void handleExport("webm")}
        >
          <DownloadIcon className="mr-1 h-3 w-3" />
          WebM
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          disabled={isExporting || !isSpineLoaded}
          onClick={() => void handleExport("mp4")}
        >
          <DownloadIcon className="mr-1 h-3 w-3" />
          MP4
        </Button>
      </div>

      <Separator className="my-1" />

      {/* Playback Controls */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          size="sm"
          variant={isPlaying ? "outline" : "default"}
          className="h-9 text-xs"
          disabled={isExporting || !isSpineLoaded}
          onClick={togglePlayback}
        >
          {isPlaying ? (
            <PauseIcon className="h-4 w-4" />
          ) : (
            <PlayIcon className="h-4 w-4" />
          )}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-9 text-xs"
          disabled={isExporting || !isSpineLoaded}
          onClick={controls.setDefaultPositionAndScale}
        >
          <RotateCcwIcon className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline" // Ensures all buttons have the same style
          className="h-9 text-xs"
          disabled={isExporting || !isSpineLoaded}
          onClick={toggleDebugMode}
        >
          <BugIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default SpineControlPanel;
