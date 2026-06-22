import { EventCategory, PriceType } from "@eventscout/shared";
export interface FilterState {
    categories: EventCategory[];
    time_range: "today" | "this_weekend" | "custom";
    radiusKm: number;
    price_type: PriceType | "";
    confidence_min: number;
}
interface FilterBarProps {
    value: FilterState;
    onChange: (value: FilterState) => void;
}
export declare function FilterBar({ value, onChange }: FilterBarProps): import("react").JSX.Element;
export {};
