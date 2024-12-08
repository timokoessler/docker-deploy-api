import type { Context } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';
import { isIP } from 'node:net';

export function isBehindProxy() {
    return process.env.BEHIND_PROXY === 'true';
}

export function getIPAddress(
    remoteAddress: string,
    headers: Record<string, string>,
) {
    if (
        headers &&
        isBehindProxy() &&
        typeof headers['x-forwarded-for'] === 'string'
    ) {
        const xForwardedFor = getClientIpFromXForwardedFor(
            headers['x-forwarded-for'],
        );
        if (xForwardedFor && isIP(xForwardedFor)) {
            return xForwardedFor;
        }
    }

    if (remoteAddress && isIP(remoteAddress)) {
        return remoteAddress;
    }
}

export function getIPAddressFromHono(c: Context): string | undefined {
    const info = getConnInfo(c);

    if (!info.remote.address) {
        return undefined;
    }

    return getIPAddress(info.remote.address, c.req.header());
}

// Copied from Firewall Node by Aikido Security
// https://github.com/AikidoSec/firewall-node/blob/7757f327e269556f5205e90a276cad6e78107823/library/helpers/getIPAddressFromRequest.ts#L26
function getClientIpFromXForwardedFor(value: string) {
    const forwardedIps = value.split(',').map((e) => {
        const ip = e.trim();

        if (ip.includes(':')) {
            const parts = ip.split(':');

            if (parts.length === 2) {
                return parts[0];
            }
        }

        return ip;
    });

    for (const forwardedIp of forwardedIps) {
        if (isIP(forwardedIp)) {
            return forwardedIp;
        }
    }
}
