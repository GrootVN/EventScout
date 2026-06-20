import { TrustedSource } from "@eventscout/shared";
interface TrustedSourcesManagerProps {
    initialSources: TrustedSource[];
    adminToken?: string;
}
export declare function TrustedSourcesManager({ initialSources, adminToken }: TrustedSourcesManagerProps): import("react").JSX.Element;
export {};
