> **Reference copy.** This is the upstream project overview. It was written for the open-source upstream project and has been rebranded to SmartWarmupAI: the product name in prose is changed, while commands, binary names, settings, API paths and code blocks keep their original names because the software still uses them. Sections about the backend (workers, migrations, installers, security process) apply to a connected upstream-compatible backend, not to how this repository is maintained.

## SmartWarmupAI

SmartWarmupAI runs cold email campaigns from the mailboxes you already own and warms
them so they keep landing in the inbox. Opens, clicks, and replies land in a
shared dashboard the moment they happen, and it's AI-native, so your team and its
agents work in it together, live.

<https://github.com/user-attachments/assets/378a510a-bb99-425f-925e-04300184938b>

## Features

- **Campaigns** - multi-step sequences with per-mailbox caps and spacing
- **Unified inbox** - every mailbox and reply in one place
- **CRM** - contacts, pipelines, deals, tasks, meetings
- **Warmup** - a pool of monitored mailboxes, not throwaway accounts
- **Deliverability** - bounces, complaints, suppression, inbox placement
- **Automations** - visual reply playbooks with AI steps
- **Integrations** - HubSpot, Slack, Zapier, REST API, webhooks
- **Realtime** - live presence and edits across your team

## How it works

SmartWarmupAI splits into a **control plane** (backend API, consumer, Postgres, Redis,
and the event bus) that owns all state, and an **execution plane** of
interchangeable Go workers that send and sync mail. Workers never touch Postgres,
and outbound mail leaves through each mailbox's own provider, not the worker's IP,
so you add throughput by running more workers.

```mermaid
flowchart LR
  MB["Your mailboxes"] --> API
  subgraph CP["Control plane"]
    direction TB
    API["Backend API"] --> DB[("Postgres")]
    API --> BUS{{"Event bus"}}
  end
  BUS --> W1["Worker"]
  BUS --> W2["Worker"]
  BUS --> W3["Worker"]
  W1 --> P["Gmail · Microsoft · SMTP"]
  W2 --> P
  W3 --> P
  P --> R["Recipients"]
```

Secrets use envelope encryption, with a local AES master key by default or AWS KMS
if you prefer. Full write-up in the
[architecture docs](/smartwarmupai-help/development/architecture/).

## Quick start

You need Docker, Go 1.25, and pnpm.

```bash
git clone https://github.com/warmbly/warmbly && cd warmbly
make dev
```

Open `http://localhost:5173` and log in with `dev@warmbly.com` / `password123`;
the login code lands in Mailpit at `http://localhost:18025`. Every make target,
the native services, and how seeding works are in the
[local development guide](/smartwarmupai-help/development/local-development/).

> \[!WARNING]
> `make dev` and `make up` share one database, and seeded fixture accounts claim
> the instance. Planning to self-host from the same machine? Read
> [first run](/smartwarmupai-help/development/first-run/) first.

## Self-hosting



SmartWarmupAI runs with **no cloud account of any kind**: no AWS, no GCP, no Stripe, no
Kafka. One command brings up the whole platform on local, open-source pieces:

```bash
curl -fsSL https://warmbly.com/install.sh | sh
```

That pulls the published release images, writes a real `.env`, starts the stack
and prints the one-time link that claims the instance and makes you its admin.
No clone, no compiler, under two minutes. Add `--wizard` and it asks where each
store lives, what is kept and for how long, and how it is backed up. The script
is checksummed at `install.sh.sha256` if you would rather download, verify and
read it first, `--dry-run` prints every file it would write without touching
anything, and `--demo` walks the whole wizard while installing nothing. Full
flag list: [install](/smartwarmupai-help/development/install/).

To build it from source instead:

```bash
git clone https://github.com/warmbly/warmbly && cd warmbly
make up
```

Either way you need Docker with Compose v2; the build path also wants about
10 GB of free disk. If anything looks wrong, `make doctor` prints the instance
state and every failing check.

From here the
[self-hosting guide](/smartwarmupai-help/development/deployment-guide/)
covers the rest: your own secrets, production hardening, mail and single
sign-on, HTTPS, connecting Gmail and Microsoft mailboxes, scaling workers, and
backups. Account recovery and every operator command live in
[`warmblyctl`](/smartwarmupai-help/development/warmblyctl/), the CLI baked
into the backend image; it talks to the database directly, so it works when
signing in does not.

## Documentation

The full docs live at **[docs.warmbly.com](/smartwarmupai-help)**.

| Read this                                                                   | To learn                                                                                        |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [Install](/smartwarmupai-help/development/install/)                         | The one-command install and its wizard: where the data lives, what is kept, how it is backed up |
| [Self-hosting guide](/smartwarmupai-help/development/deployment-guide/)     | Building from source, then production, backups, and scaling the worker fleet                    |
| [Data control](/smartwarmupai-help/development/data-control/)               | Every store's location, every retention window, instance backups, and moving to another host    |
| [First run](/smartwarmupai-help/development/first-run/)                     | Claiming the instance, reissuing the setup link, and what to do when accounts already exist     |
| [Accounts and access](/smartwarmupai-help/development/accounts-and-access/) | Registration modes, inviting people with or without a mail relay, SSO, and recovering access    |
| [`warmblyctl`](/smartwarmupai-help/development/warmblyctl/)                 | The operator CLI: creating accounts, setting passwords, granting admin, and instance status     |
| [Configuration reference](/smartwarmupai-help/development/configuration/)   | Every environment variable, its default, and whether changing it needs a restart                |
| [Instance health](/smartwarmupai-help/development/instance-health/)         | The checks the admin panel runs against your deployment, and `make doctor`                      |
| [Troubleshooting](/smartwarmupai-help/development/troubleshooting/)         | The errors self-hosters actually hit, and the command that fixes each one                       |
| [Local development](/smartwarmupai-help/development/local-development/)     | Every make target, the native services, and how seeding works                                   |
| [Architecture](/smartwarmupai-help/development/architecture/)               | How the control plane and workers split the job, plus the encryption model                      |
| [API reference](/smartwarmupai-help/api/)                                   | Endpoints, auth, permissions, and webhooks                                                      |

## Community

Have a question, found a bug, or want to shape where SmartWarmupAI goes next?

- **Discord** - chat with the team and other senders
- **[GitHub Issues](https://github.com/warmbly/warmbly/issues)** - report bugs and request features
- **X / @WarmblyHQ** - follow along for updates and releases
- **GitHub Sponsors** - support SmartWarmupAI's development
- **Email** - reach us at `team@warmbly.com`

## Support and enterprise

> \[!NOTE]
> **Need a hand? We are happy to help.** Ask in Discord, open a [GitHub issue](https://github.com/warmbly/warmbly/issues), or email `team@warmbly.com`, and someone on the team will get back to you.
>
> **Running SmartWarmupAI at scale, or would you rather we run it for you?** We offer **enterprise support** and **managed infrastructure**: we can host and operate the whole platform for your organization, help you deploy and scale the worker fleet, tune deliverability, migrate your sending onto SmartWarmupAI, and stand behind it with a support agreement built around your team. Tell us what you need at `team@warmbly.com` or reach out on X.

## Star the repository ⭐

## Contributing

Pull requests are welcome. Keep each one to a single logical change, and open an
issue first for larger design or product changes. Before you open a PR, run the
checks for the tree you touched (`make fmt` and `make lint` for Go, `pnpm
typecheck` and `pnpm lint` for the frontends). See CONTRIBUTING.md.

## Security

Found a vulnerability? Email `team@warmbly.com` instead of opening a public issue.
We prefer responsible disclosure and credit reporters in the release notes.

## License

Apache License 2.0. Copyright 2026 Mindroot Ltd. See LICENSE.
