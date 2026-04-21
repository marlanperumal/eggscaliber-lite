"""add access control tables

Revision ID: 905885685f23
Revises: 8d74f2421903
Create Date: 2026-04-21 11:06:21.668939

"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel
from alembic import op

revision: str = "905885685f23"
down_revision: str | None = "8d74f2421903"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create packagevisibility enum explicitly (op.add_column doesn't auto-create types)
    op.execute("CREATE TYPE packagevisibility AS ENUM ('public', 'private')")

    # Add visibility to package
    op.add_column(
        "package",
        sa.Column(
            "visibility",
            sa.Enum("public", "private", name="packagevisibility", create_type=False),
            nullable=False,
            server_default="public",
        ),
    )

    # Create package_collections (replaces collection.package_id)
    # Enum type packagecollectionscope auto-created by op.create_table
    op.create_table(
        "package_collections",
        sa.Column("package_id", sa.Integer(), nullable=False),
        sa.Column("collection_id", sa.Integer(), nullable=False),
        sa.Column(
            "scope",
            sa.Enum("all", "selected", name="packagecollectionscope"),
            nullable=False,
            server_default="all",
        ),
        sa.ForeignKeyConstraint(["collection_id"], ["collection.id"]),
        sa.ForeignKeyConstraint(["package_id"], ["package.id"]),
        sa.PrimaryKeyConstraint("package_id", "collection_id"),
    )

    # Migrate existing collection.package_id data
    op.execute(
        "INSERT INTO package_collections (package_id, collection_id, scope) "
        "SELECT package_id, id, 'all' FROM collection WHERE package_id IS NOT NULL"
    )

    # Drop collection.package_id
    op.drop_constraint("collection_package_id_fkey", "collection", type_="foreignkey")
    op.drop_column("collection", "package_id")

    # Create package_collection_datasets
    op.create_table(
        "package_collection_datasets",
        sa.Column("package_id", sa.Integer(), nullable=False),
        sa.Column("collection_id", sa.Integer(), nullable=False),
        sa.Column("dataset_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["package_id", "collection_id"],
            ["package_collections.package_id", "package_collections.collection_id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["dataset_id"], ["dataset.id"]),
        sa.PrimaryKeyConstraint("package_id", "collection_id", "dataset_id"),
    )

    # Create org_subscriptions
    op.create_table(
        "org_subscriptions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("org_id", sa.Integer(), nullable=False),
        sa.Column("package_id", sa.Integer(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["org_id"], ["organisations.id"]),
        sa.ForeignKeyConstraint(["package_id"], ["package.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("org_id", "package_id"),
    )

    # Create groups
    op.create_table(
        "groups",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("org_id", sa.Integer(), nullable=False),
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default="false"),
        sa.ForeignKeyConstraint(["org_id"], ["organisations.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("org_id", "name"),
    )

    # Create group_memberships
    op.create_table(
        "group_memberships",
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("group_id", "user_id"),
    )

    # Create group_packages
    op.create_table(
        "group_packages",
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column("package_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"]),
        sa.ForeignKeyConstraint(["package_id"], ["package.id"]),
        sa.PrimaryKeyConstraint("group_id", "package_id"),
    )


def downgrade() -> None:
    op.drop_table("group_packages")
    op.drop_table("group_memberships")
    op.drop_table("groups")
    op.drop_table("org_subscriptions")
    op.drop_table("package_collection_datasets")

    # Restore collection.package_id from package_collections before dropping
    op.add_column("collection", sa.Column("package_id", sa.Integer(), nullable=True))
    op.execute(
        "UPDATE collection c SET package_id = pc.package_id "
        "FROM package_collections pc WHERE pc.collection_id = c.id"
    )
    op.alter_column("collection", "package_id", nullable=False)
    op.create_foreign_key(
        "collection_package_id_fkey",
        "collection",
        "package",
        ["package_id"],
        ["id"],
    )

    op.drop_table("package_collections")
    sa.Enum(name="packagecollectionscope").drop(op.get_bind(), checkfirst=True)

    op.drop_column("package", "visibility")
    sa.Enum(name="packagevisibility").drop(op.get_bind(), checkfirst=True)
