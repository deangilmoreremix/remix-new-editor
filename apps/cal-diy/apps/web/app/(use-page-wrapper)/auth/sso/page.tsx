import { _generateMetadata } from "app/_utils";

import SsoView from "~/auth/sso-view";

export const generateMetadata = async () => {
  return await _generateMetadata(
    () => "Signing you in",
    () => "Signing you in to scheduling",
    undefined,
    undefined,
    "/auth/sso"
  );
};

const Page = () => <SsoView />;

export default Page;
