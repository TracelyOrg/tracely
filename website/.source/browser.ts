// @ts-nocheck
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  docs: create.doc("docs", {"index.mdx": () => import("../content/docs/index.mdx?collection=docs"), "configuration/custom-redaction.mdx": () => import("../content/docs/configuration/custom-redaction.mdx?collection=docs"), "configuration/environment-variables.mdx": () => import("../content/docs/configuration/environment-variables.mdx?collection=docs"), "dashboard/pulse-view.mdx": () => import("../content/docs/dashboard/pulse-view.mdx?collection=docs"), "dashboard/trace-inspector.mdx": () => import("../content/docs/dashboard/trace-inspector.mdx?collection=docs"), "frameworks/django.mdx": () => import("../content/docs/frameworks/django.mdx?collection=docs"), "frameworks/fastapi.mdx": () => import("../content/docs/frameworks/fastapi.mdx?collection=docs"), "frameworks/flask.mdx": () => import("../content/docs/frameworks/flask.mdx?collection=docs"), "getting-started/installation.mdx": () => import("../content/docs/getting-started/installation.mdx?collection=docs"), "getting-started/overview.mdx": () => import("../content/docs/getting-started/overview.mdx?collection=docs"), "getting-started/quick-start.mdx": () => import("../content/docs/getting-started/quick-start.mdx?collection=docs"), "sdk-reference/attributes.mdx": () => import("../content/docs/sdk-reference/attributes.mdx?collection=docs"), "sdk-reference/custom-spans.mdx": () => import("../content/docs/sdk-reference/custom-spans.mdx?collection=docs"), "sdk-reference/init.mdx": () => import("../content/docs/sdk-reference/init.mdx?collection=docs"), }),
};
export default browserCollections;