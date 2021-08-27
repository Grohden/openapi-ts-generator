# Open API ts generator

This is just an ~unpublished~ code for a typescript codegen for openAPI 3.0.

## What it does?
It generates a code that can be used in probably any JS environment (node, web, RN), but it doesn't
deal with a LOT of corner cases in spec and probably doesn't work with most generated ones. Usually it will work
well with NestJS generated specs, since I've used a NestJS generated one to write this code.

## Just for reading

So, I was inspired on some nights and wrote this code without properly searching if someone had done it before.

I found two alternatives:
* [openapi-ts-codegen](https://www.npmjs.com/package/openapi-ts-codegen)
* [openapi-typescript-codegen](https://www.npmjs.com/package/openapi-typescript-codegen)

~~The later one aligns a lot with what I've wanted to do, so I'm going to stick with it.~~ But I'm publishing my code
for history purposes, it was fun to write it :D

I'm not using the last one anymore because it doesn't support global interceptors, and this is an essential
feature for me.

## Running

If you are really interested in running this generator:

```shell
npx @grohden/openapi-ts-generator --spec "path or URL" --output ./test
```

### Using the generated code

The generated classes are 'request client agnostic', in the sense that all service classes
delegate its domain knowledge to an `Adapter`, and you're the responsible for instantiating
this adapter. This way we can use the generated code using fetch, axios or any other client
that you may wish to use.

The adapter signature is this: 
```typescript
export type Adapter = <T>(args: {
  url: string
  method: 'POST' | 'GET' | 'PATCH' | 'DELETE' | 'PUT'
  queryParams?: any
  bodyArgs?: any
}) => Promise<T>
```

As an example, here's an adapter that I'm using for fetch:
<details>

```typescript
import type { Configuration } from './generated-api';

export const createConfiguration = (handlers?: {
  onUnauthorized: () => void;
}): Configuration => {
  return {
    baseUrl: releaseChannel === 'default' ? API_URL_PROD! : API_URL_DEV!,
    adapter: async ({ method, url, bodyArgs, queryParams }) => {
      const effectiveUrl = new URL(url);
      const user = await Storage.get<{ apiToken?: string } | undefined>('@user');
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      };

      if (user?.apiToken) {
        headers['Authorization'] = `Bearer ${user.apiToken}`;
      }

      for (const [key, value] of Object.entries(queryParams || {})) {
        effectiveUrl.searchParams.append(key, value as string);
      }

      try {
        const response = await fetch(effectiveUrl.toString(), {
          method,
          headers,
          body: bodyArgs ? JSON.stringify(bodyArgs) : undefined,
        });

        return await response.json();
      } catch (error) {
        if (error?.statusCode === 401) {
          handlers?.onUnauthorized();
        }
        __DEV__ && console.log(JSON.stringify(error));

        throw error;
      }
    },
  };
};
```

</details>


So, given a spec that works with this client, it will create at least one service file
that exposes a class that doesn't have any domain on how its request will be executed, instead, it delegates that
responsability to you, through an adapter that you should implement.
