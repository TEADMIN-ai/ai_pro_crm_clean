import { isContractorVisibleToWorkspace } from "@/lib/contractors/contractorVisibility";

const context = { workspaceId: "workspace-a", actorRole: "staff" };

describe("contractor repository user profile exclusion", () => {
  it.each(["admin", "staff", "manager"])("excludes %s users without canonical contractor identity", (role) => {
    const decision = isContractorVisibleToWorkspace(
      {
        id: "z0yX8cyt38hkfa6OUEyNTOiX2812",
        uid: "z0yX8cyt38hkfa6OUEyNTOiX2812",
        role,
        status: "active",
        name: "Mr K",
        workspaceId: "workspace-a",
      },
      context,
    );

    expect(decision).toMatchObject({ visible: false, reason: "staff_user_profile" });
  });

  it("does not treat workspace membership alone as contractor identity", () => {
    const decision = isContractorVisibleToWorkspace(
      {
        id: "workspace-member",
        uid: "workspace-member",
        role: "staff",
        workspace: { id: "workspace-a", displayName: "Torque Empire" },
        status: "active",
      },
      context,
    );

    expect(decision).toMatchObject({ visible: false, reason: "staff_user_profile" });
  });

  it("includes contractor-linked users only through a visible canonical contractor record", () => {
    const decision = isContractorVisibleToWorkspace(
      {
        id: "contractor-doc",
        contractorId: "contractor-doc",
        linkedUserId: "user-1",
        role: "contractor",
        workspaceId: "workspace-a",
        identityResolved: true,
        legalName: "Mackay and Daughters Enterprises (Pty) Ltd",
        status: "active",
      },
      context,
    );

    expect(decision.visible).toBe(true);
  });
});

