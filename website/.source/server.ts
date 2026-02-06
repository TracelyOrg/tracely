// @ts-nocheck
import * as __fd_glob_17 from "../content/docs/sdk-reference/init.mdx?collection=docs"
import * as __fd_glob_16 from "../content/docs/sdk-reference/custom-spans.mdx?collection=docs"
import * as __fd_glob_15 from "../content/docs/sdk-reference/attributes.mdx?collection=docs"
import * as __fd_glob_14 from "../content/docs/getting-started/quick-start.mdx?collection=docs"
import * as __fd_glob_13 from "../content/docs/getting-started/overview.mdx?collection=docs"
import * as __fd_glob_12 from "../content/docs/getting-started/installation.mdx?collection=docs"
import * as __fd_glob_11 from "../content/docs/frameworks/flask.mdx?collection=docs"
import * as __fd_glob_10 from "../content/docs/frameworks/fastapi.mdx?collection=docs"
import * as __fd_glob_9 from "../content/docs/frameworks/django.mdx?collection=docs"
import * as __fd_glob_8 from "../content/docs/dashboard/trace-inspector.mdx?collection=docs"
import * as __fd_glob_7 from "../content/docs/dashboard/pulse-view.mdx?collection=docs"
import * as __fd_glob_6 from "../content/docs/configuration/environment-variables.mdx?collection=docs"
import * as __fd_glob_5 from "../content/docs/configuration/custom-redaction.mdx?collection=docs"
import * as __fd_glob_4 from "../content/docs/alerts/slack-integration.mdx?collection=docs"
import * as __fd_glob_3 from "../content/docs/alerts/overview.mdx?collection=docs"
import * as __fd_glob_2 from "../content/docs/alerts/discord-integration.mdx?collection=docs"
import * as __fd_glob_1 from "../content/docs/index.mdx?collection=docs"
import { default as __fd_glob_0 } from "../content/docs/meta.json?collection=docs"
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>({"doc":{"passthroughs":["extractedReferences"]}});

export const docs = await create.docs("docs", "content/docs", {"meta.json": __fd_glob_0, }, {"index.mdx": __fd_glob_1, "alerts/discord-integration.mdx": __fd_glob_2, "alerts/overview.mdx": __fd_glob_3, "alerts/slack-integration.mdx": __fd_glob_4, "configuration/custom-redaction.mdx": __fd_glob_5, "configuration/environment-variables.mdx": __fd_glob_6, "dashboard/pulse-view.mdx": __fd_glob_7, "dashboard/trace-inspector.mdx": __fd_glob_8, "frameworks/django.mdx": __fd_glob_9, "frameworks/fastapi.mdx": __fd_glob_10, "frameworks/flask.mdx": __fd_glob_11, "getting-started/installation.mdx": __fd_glob_12, "getting-started/overview.mdx": __fd_glob_13, "getting-started/quick-start.mdx": __fd_glob_14, "sdk-reference/attributes.mdx": __fd_glob_15, "sdk-reference/custom-spans.mdx": __fd_glob_16, "sdk-reference/init.mdx": __fd_glob_17, });