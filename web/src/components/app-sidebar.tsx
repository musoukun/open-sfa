import { Link, useLocation, useNavigate } from "react-router";
import {
  Briefcase,
  Building2,
  ChevronsUpDown,
  FileText,
  LayoutDashboard,
  LogOut,
  MailPlus,
  MessagesSquare,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { authClient, type SessionUser } from "@/lib/auth-client";
import { initials } from "@/lib/format";

type NavItem = { title: string; to: string; icon: LucideIcon };

const SALES_NAV: NavItem[] = [
  { title: "ダッシュボード", to: "/", icon: LayoutDashboard },
  { title: "案件", to: "/deals", icon: Briefcase },
  { title: "商談", to: "/meetings", icon: MessagesSquare },
  { title: "見積", to: "/quotes", icon: FileText },
  { title: "顧客", to: "/customers", icon: Building2 },
];

const ORG_NAV: NavItem[] = [
  { title: "社内メンバー", to: "/members", icon: Users },
  { title: "招待", to: "/invitations", icon: MailPlus },
];
const ADMIN_NAV: NavItem[] = [{ title: "アカウント管理", to: "/admin/accounts", icon: ShieldCheck }];

function NavGroup(props: { label: string; items: NavItem[] }) {
  const { pathname } = useLocation();
  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{props.label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {props.items.map((item) => (
            <SidebarMenuItem key={item.to}>
              <SidebarMenuButton asChild isActive={isActive(item.to)} tooltip={item.title}>
                <Link to={item.to}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar({ user }: { user: SessionUser }) {
  const navigate = useNavigate();
  const signOut = async () => {
    await authClient.signOut();
    navigate("/login");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Briefcase className="size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold">open-sfa</span>
                  <span className="truncate text-xs text-muted-foreground">営業支援</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup label="営業" items={SALES_NAV} />
        <NavGroup label="組織" items={ORG_NAV} />
        {user.role === "admin" && <NavGroup label="管理" items={ADMIN_NAV} />}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" data-testid="user-menu">
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg">{initials(user.name)}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="text-sm font-medium">{user.name}</div>
                  <div className="text-xs text-muted-foreground">{user.role === "admin" ? "管理者" : "一般ユーザー"}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate("/settings")}>
                  <Settings />
                  個人設定
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={signOut}>
                  <LogOut />
                  ログアウト
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
