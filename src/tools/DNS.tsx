import { XCircleIcon } from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import TextInput from "@/components/TextInput";
import { useDNSQuery } from "@/hooks/useApiQuery";
import type { DNSRecord } from "@/types";

const EXAMPLE_DOMAINS = [
  "facebook.com",
  "good.tools",
  "ronin.ae",
  "gmail.com",
  "apple.com",
  "microsoft.com",
];

function DNS() {
  const [address, setAddress] = useState("");
  const [shouldFetch, setShouldFetch] = useState(false);
  const addressRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, error, refetch } = useDNSQuery(address, shouldFetch);

  const clear = () => {
    setAddress("");
    setShouldFetch(false);
  };

  const loadRandom = () => {
    const domain =
      EXAMPLE_DOMAINS[Math.floor(Math.random() * EXAMPLE_DOMAINS.length)];
    setAddress(domain ?? "");
    setShouldFetch(false);
  };

  const load = () => {
    if (!address) return;
    setShouldFetch(true);
  };

  useEffect(() => {
    addressRef.current?.focus();
  }, []);

  // Trigger refetch when shouldFetch becomes true
  useEffect(() => {
    if (shouldFetch) {
      refetch();
    }
  }, [shouldFetch, refetch]);

  return (
    <div>
      <div className="mt-5">
        <TextInput
          ref={addressRef}
          type="text"
          name="domain"
          id="domain"
          className="block w-full"
          placeholder="example.com"
          value={address}
          onEnter={load}
          onChange={(e) => setAddress(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="mt-2">
        <Button
          onClick={load}
          disabled={isLoading}
          variant="filled"
          className="items-center"
        >
          {isLoading ? (
            <>
              Lookup
              <svg
                aria-hidden="true"
                className="ml-1 w-4 h-4 text-gray-200 animate-spin dark:text-gray-600 fill-gray-500"
                viewBox="0 0 100 101"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                  fill="currentColor"
                />
                <path
                  d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                  fill="currentFill"
                />
              </svg>
            </>
          ) : (
            <>Lookup</>
          )}
        </Button>
        <Button
          variant="text"
          className="ml-3"
          disabled={isLoading}
          onClick={loadRandom}
        >
          Pick a random domain
        </Button>
        <Button
          variant="text"
          className="ml-3"
          disabled={isLoading}
          onClick={clear}
        >
          Clear
        </Button>
      </div>
      {error && (
        <div className="rounded-md bg-red-50 p-4 mt-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <XCircleIcon
                className="h-5 w-5 text-red-400"
                aria-hidden="true"
              />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                {error instanceof Error ? error.message : "An error occurred"}
              </h3>
            </div>
          </div>
        </div>
      )}
      {data && (
        <div className="mt-3 overflow-hidden w-full dark:bg-zinc-800 shadow dark:shadow-zinc-900 sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg font-medium leading-6">Results</h3>
          </div>
          <div className="border-t border-gray-200 dark:border-zinc-700 px-4 py-5 sm:px-6">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
              {Object.keys(data)
                .filter((k) => k !== "message")
                .map((k, i) => (
                  <div key={`rec-${i}`} className="sm:col-span-1">
                    <dt className="text-sm font-medium text-gray-500">{k}</dt>
                    <dd className="mt-1 text-sm">
                      <ul>
                        {Array.isArray(data[k]) &&
                          data[k].map((record, j) => (
                            <li key={`rec-${i}-${j}`}>{record.content}</li>
                          ))}
                      </ul>
                    </dd>
                  </div>
                ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}

export default DNS;
