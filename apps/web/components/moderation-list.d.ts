import { EventRecord } from "@eventscout/shared";
interface ModerationListProps {
    initialEvents: EventRecord[];
    adminToken?: string;
}
export declare function ModerationList({ initialEvents, adminToken }: ModerationListProps): import("react").JSX.Element;
export {};
