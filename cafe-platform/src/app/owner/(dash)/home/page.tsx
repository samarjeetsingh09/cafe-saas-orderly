import { redirect } from "next/navigation";

/** `/owner/home` is retired — Orders (the live board) is now the console landing tab. */
export default function Page() {
  redirect("/owner/orders");
}
