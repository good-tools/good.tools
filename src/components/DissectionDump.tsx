import { useEffect, useState } from "react";

interface HighlightedTextProps {
  text: string;
  start: number;
  size: number;
  onOffsetClicked: (offset: number) => void;
}

function HighlightedText({
  text,
  start,
  size,
  onOffsetClicked,
}: HighlightedTextProps) {
  const before = text.substring(0, start);
  const hl = text.substring(start, start + size);
  const end = text.substring(start + size);

  const handleClickWithOffset = (
    _e: React.MouseEvent<HTMLSpanElement>,
    offset: number
  ) => {
    const s = window.getSelection();
    if (s) {
      onOffsetClicked(s.anchorOffset + offset);
    }
  };

  return (
    <>
      <span onClick={(e) => handleClickWithOffset(e, 0)}>{before}</span>
      <span
        onClick={(e) => handleClickWithOffset(e, before.length)}
        className="bg-gray-600 text-white"
      >
        {hl}
      </span>
      <span
        onClick={(e) => handleClickWithOffset(e, before.length + hl.length)}
      >
        {end}
      </span>
    </>
  );
}

interface DissectionDumpProps {
  buffer: Uint8Array;
  selected: [number, number];
  select: (offset: number) => void;
}

function DissectionDump({ buffer, selected, select }: DissectionDumpProps) {
  const [addrLines, setAddrLines] = useState<string[]>([]);
  const [hexLines, setHexLines] = useState<string[]>([]);
  const [asciiLines, setAsciiLines] = useState<string[]>([]);

  const [asciiHighlight, setAsciiHighlight] = useState<[number, number]>([
    0, 0,
  ]);
  const [hexHighlight, setHexHighlight] = useState<[number, number]>([0, 0]);

  useEffect(() => {
    const start = selected[0];
    const size = selected[1];

    const hexSize = size * 2 + size - 1;
    const hexPos = start * 2 + start;
    const asciiPos = start + Math.floor(start / 16);
    const asciiSize = start + size + Math.floor((start + size) / 16) - asciiPos;

    setAsciiHighlight([asciiPos, size > 0 ? asciiSize : 0]);
    setHexHighlight([hexPos, size > 0 ? hexSize : 0]);
  }, [selected]);

  useEffect(() => {
    const addr_lines: string[] = [];
    const hex_lines: string[] = [];
    const ascii_lines: string[] = [];

    for (let i = 0; i < buffer.length; i += 16) {
      const address = i.toString(16).padStart(8, "0"); // address
      const block = buffer.slice(i, i + 16); // cut buffer into blocks of 16
      const hexArray: string[] = [];
      const asciiArray: string[] = [];

      for (const value of block) {
        hexArray.push(value.toString(16).padStart(2, "0"));
        asciiArray.push(
          value >= 0x20 && value < 0x7f ? String.fromCharCode(value) : "."
        );
      }

      const hexString =
        hexArray.length > 8
          ? hexArray.slice(0, 8).join(" ") + "　" + hexArray.slice(8).join(" ")
          : hexArray.join(" ");

      const asciiString = asciiArray.join("");

      addr_lines.push(address);
      hex_lines.push(hexString);

      ascii_lines.push(asciiString);
    }

    setAddrLines(addr_lines);
    setAsciiLines(ascii_lines);
    setHexLines(hex_lines);
  }, [buffer]);

  const onHexClick = (offset: number) => {
    select(Math.floor(offset / 3));
  };

  const onAsciiClick = (offset: number) => {
    select(offset - Math.floor(offset / 17));
  };

  return (
    <div className="flex font-mono text-xs whitespace-pre break-all">
      <div className="tbd-offset select-none text-gray-500">
        {addrLines.join("\n")}
      </div>
      <div className="ml-4 cursor-pointer">
        <HighlightedText
          onOffsetClicked={onHexClick}
          text={hexLines.join("\n")}
          start={hexHighlight[0]}
          size={hexHighlight[1]}
        />
      </div>
      <div className="ml-4 cursor-pointer">
        <HighlightedText
          onOffsetClicked={onAsciiClick}
          text={asciiLines.join("\n")}
          start={asciiHighlight[0]}
          size={asciiHighlight[1]}
        />
      </div>
    </div>
  );
}

export default DissectionDump;
