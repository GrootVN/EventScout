import { EventRecord } from "@eventscout/shared";
interface MapCanvasProps {
    center: {
        lat: number;
        lng: number;
    };
    events: EventRecord[];
}
export declare function MapCanvas({ center, events }: MapCanvasProps): import("react").JSX.Element;
export {};
