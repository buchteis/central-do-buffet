import { queryOptions } from "@tanstack/react-query";
import { getSupportInbox } from "./support.functions";

export const supportInboxOptions = () => queryOptions({
  queryKey: ["support-inbox"],
  queryFn: () => getSupportInbox(),
  refetchInterval: 10_000,
  staleTime: 0,
});