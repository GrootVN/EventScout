import { EventCategory } from "@eventscout/shared";
interface InterestPickerProps {
    selected: EventCategory[];
    onChange: (selected: EventCategory[]) => void;
}
export declare function InterestPicker({ selected, onChange }: InterestPickerProps): import("react").JSX.Element;
export {};
