import Link from "next/link";

import { Icon } from "./icon";

type Breadcrumb = { href?: string; label: string };

export function PageHeading({
  breadcrumbs,
  description,
  title,
}: {
  breadcrumbs?: Breadcrumb[];
  description?: string;
  title: string;
}) {
  return (
    <div>
      {breadcrumbs && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-[#718078]">
          {breadcrumbs.map((item, index) => (
            <span className="flex items-center gap-1.5" key={`${item.label}-${index}`}>
              {index > 0 && <Icon className="size-3" name="chevron" />}
              {item.href ? (
                <Link className="hover:text-[#26744b]" href={item.href}>
                  {item.label}
                </Link>
              ) : (
                <span>{item.label}</span>
              )}
            </span>
          ))}
        </div>
      )}
      <h1 className="text-2xl font-semibold tracking-[-0.035em] text-[#17211b] md:text-[28px]">
        {title}
      </h1>
      {description && (
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#68756c]">
          {description}
        </p>
      )}
    </div>
  );
}
