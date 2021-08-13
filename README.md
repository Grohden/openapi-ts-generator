# Open API ts generator

This is just an unpublished code for a typescript codegen for openAPI 3.0.

> Note: to be able to try it you should have a schema
> located in the src folder and named `spec.json`, then you can use ts-node 
> on the generator.ts file to see the results

## What it does?
It generates a code that can be used in probably any JS environment (node, web, RN), but it doesn't
deal with a LOT of corner cases in spec and probably doesn't work with most generated ones. Usually it will work
well with NestJS generated specs, since I've used a NestJS generated one to write this code.

## Just for reading

So, I was inspired on some nights and wrote this code without properly searching if someone had done it before.

I found two alternatives:
* [openapi-ts-codegen](https://www.npmjs.com/package/openapi-ts-codegen)
* [openapi-typescript-codegen](https://www.npmjs.com/package/openapi-typescript-codegen)

The later one aligns a lot with what I've wanted to do, so I'm going to stick with it. But I'm publishing my code
for history purposes, it was fun to write it :D